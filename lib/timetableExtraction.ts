import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { createWorker } from "tesseract.js";

// gemini-2.5-flash is no longer available to new API keys at all (404, not
// transient) - Google's own error message points to the 3.x line instead.
// Try 3.6 first (mid-tier, likely least contended), then the newer/older
// flagships as fallback.
const VISION_MODELS = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"];
const TEXT_FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.7-flash"];

function isRetryableStatus(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  // 404 is included because it can mean "this model isn't available to this
  // key" (a per-model access issue, not a bad request) - worth trying the
  // next model in the list rather than failing outright.
  return status === 503 || status === 429 || status === 404;
}

export interface TimetableExtraction {
  courses: Array<{ code: string; name: string }>;
  entries: Array<{
    subjectCode: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room?: string;
    instructor?: string;
  }>;
}

// Typed as Schema so the compiler catches malformed enum values (the
// Gemini API expects uppercase Type members - e.g. "OBJECT", not "object" -
// and lowercase values were previously silently accepted by the SDK's
// looser inline object literal, then rejected by the API at request time).
const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    courses: {
      type: Type.ARRAY,
      description: "One entry per distinct subject code that appears in entries[]",
      items: {
        type: Type.OBJECT,
        properties: {
          code: {
            type: Type.STRING,
            description: "Short subject code exactly as shown in the timetable, e.g. 'IA 3'",
          },
          name: {
            type: Type.STRING,
            description:
              "Full subject name from the legend/key if one is present (e.g. 'Investment Analysis'), otherwise the same as code",
          },
        },
        required: ["code", "name"],
      },
    },
    entries: {
      type: Type.ARRAY,
      description: "One entry per class session found for the requested subjects",
      items: {
        type: Type.OBJECT,
        properties: {
          subjectCode: {
            type: Type.STRING,
            description: "Must exactly match one of the codes in courses[].code",
          },
          dayOfWeek: {
            type: Type.INTEGER,
            description:
              "0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday",
          },
          startTime: { type: Type.STRING, description: "24-hour HH:MM, e.g. '09:00'" },
          endTime: { type: Type.STRING, description: "24-hour HH:MM, e.g. '11:00'" },
          room: {
            type: Type.STRING,
            description: "Room or venue code if shown, else empty string",
          },
          instructor: {
            type: Type.STRING,
            description: "Instructor name or initials if shown, else empty string",
          },
        },
        required: ["subjectCode", "dayOfWeek", "startTime", "endTime", "room", "instructor"],
      },
    },
  },
  required: ["courses", "entries"],
};

const SHARED_RULES =
  "These timetables frequently list several parallel elective sections in the same day/time slot (e.g. two " +
  "different subjects shown side by side in the same cell or column) because they cover an entire cohort, " +
  "not one student. Only extract sessions for the specific subjects the student tells you they take - ignore " +
  "every other subject shown on the sheet, even if it appears in the same time slot. Match subject codes " +
  "loosely: ignore differences in spacing, case, and punctuation (e.g. 'IB3' matches 'IB 3'). If the sheet " +
  "includes a legend or key mapping short codes to full subject names, use it to fill in full names; " +
  "otherwise reuse the code as the name. Convert all times to 24-hour HH:MM format.";

const SYSTEM_INSTRUCTION_VISION =
  "You read university class timetable images or PDFs and extract a student's personal schedule from them. " +
  SHARED_RULES;

const SYSTEM_INSTRUCTION_TEXT_FALLBACK =
  "You read raw OCR text extracted from a photo of a university class timetable and reconstruct a student's " +
  "personal schedule from it. The source was a table, so OCR may have scrambled row/column order or run " +
  "fields together - use any layout clues still present (headers, numbers that look like times, proximity of " +
  "a subject code to a time range) to do your best. " +
  SHARED_RULES;

async function ocrExtractText(fileBuffer: Buffer): Promise<string> {
  // Vercel's filesystem is read-only outside /tmp; tesseract.js needs a
  // writable cachePath there for its downloaded traineddata.
  const worker = await createWorker("eng", undefined, { cachePath: "/tmp" });
  try {
    const { data } = await worker.recognize(fileBuffer);
    return data.text;
  } finally {
    await worker.terminate();
  }
}

async function callGemini(
  client: GoogleGenAI,
  models: string[],
  contents: Array<{ role: string; parts: Array<Record<string, unknown>> }>,
  systemInstruction: string
) {
  let lastError: unknown;
  for (const model of models) {
    try {
      return await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      });
    } catch (error) {
      lastError = error;
      if (!isRetryableStatus(error)) {
        throw error;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini is temporarily unavailable. Please try again shortly.");
}

/**
 * Master university timetables often show several parallel elective
 * sections in the same slot (e.g. two electives side by side on the same
 * day/time). We ask Gemini to read the table visually and keep only the
 * sessions matching the student's own subjects, since plain OCR text has no
 * sense of table structure and can't tell which subject belongs to which
 * cell in that layout - that's why vision is tried first, with OCR text
 * only used as a last-resort fallback if every vision model is overloaded.
 */
export async function extractTimetable(
  fileBuffer: Buffer,
  mimeType: string,
  subjectCodes: string[]
): Promise<TimetableExtraction> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const base64Data = fileBuffer.toString("base64");
  const subjectsLine = subjectCodes.join(", ");

  const visionContents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        {
          text:
            `This is my class timetable. My subjects are: ${subjectsLine}. Extract every class session for ` +
            "exactly these subjects, across every day shown, with their day, start time, end time, room, and " +
            "instructor where available. Leave room or instructor as an empty string if not shown.",
        },
      ],
    },
  ];

  let response;
  try {
    response = await callGemini(client, VISION_MODELS, visionContents, SYSTEM_INSTRUCTION_VISION);
  } catch (visionError) {
    const canFallBackToOcr = isRetryableStatus(visionError) && mimeType.startsWith("image/");
    if (!canFallBackToOcr) {
      throw visionError;
    }

    const ocrText = await ocrExtractText(fileBuffer);
    if (!ocrText.trim()) {
      throw visionError;
    }

    const textContents = [
      {
        role: "user",
        parts: [
          {
            text:
              `This is OCR text extracted from a photo of my class timetable. My subjects are: ${subjectsLine}. ` +
              `Raw OCR text:\n\n${ocrText}`,
          },
        ],
      },
    ];
    response = await callGemini(client, TEXT_FALLBACK_MODELS, textContents, SYSTEM_INSTRUCTION_TEXT_FALLBACK);
  }

  const text = response.text;
  if (!text) {
    throw new Error("Could not parse a schedule from this file");
  }

  const parsed = JSON.parse(text) as TimetableExtraction;
  return {
    courses: parsed.courses,
    entries: parsed.entries.map((entry) => ({
      ...entry,
      room: entry.room || undefined,
      instructor: entry.instructor || undefined,
    })),
  };
}
