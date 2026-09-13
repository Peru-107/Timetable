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
  "loosely only for spacing, case, and punctuation (e.g. 'IB3' matches 'IB 3') - never for the letters or " +
  "digits themselves. Codes that share a prefix but end differently are different subjects and must be kept " +
  "separate and never merged (e.g. 'IF1' and 'IF2' are two distinct subjects, not the same one written two " +
  "ways) - read the trailing number/letter of every code carefully, especially when subjects share a common " +
  "prefix. If the sheet includes a legend or key mapping short codes to full subject names, use it to fill in " +
  "full names; otherwise reuse the code as the name. Convert all times to 24-hour HH:MM format.";

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
/**
 * Flags subject codes that share a prefix and differ only by a trailing
 * number/letter (e.g. "IF1" vs "IF2") so the model can be told, for this
 * specific upload, exactly which codes are easy to misread into each other -
 * a targeted nudge on top of the general "don't merge similar codes" rule.
 */
export function findSimilarCodePairs(subjectCodes: string[]): Array<[string, string]> {
  const normalize = (s: string) => s.replace(/[\s\-_.]/g, "").toUpperCase();
  const prefixOf = (s: string) => normalize(s).replace(/\d+$/, "");

  const pairs: Array<[string, string]> = [];
  for (let i = 0; i < subjectCodes.length; i++) {
    for (let j = i + 1; j < subjectCodes.length; j++) {
      const a = subjectCodes[i];
      const b = subjectCodes[j];
      if (normalize(a) === normalize(b)) continue;
      const prefix = prefixOf(a);
      if (prefix && prefix === prefixOf(b)) {
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

export async function extractTimetable(
  fileBuffer: Buffer,
  mimeType: string,
  subjectCodes: string[]
): Promise<TimetableExtraction> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const base64Data = fileBuffer.toString("base64");
  const subjectsLine = subjectCodes.join(", ");

  const similarPairs = findSimilarCodePairs(subjectCodes);
  const similarPairsWarning =
    similarPairs.length > 0
      ? ` These codes look alike but are different subjects - read the ending carefully and never mix them ` +
        `up: ${similarPairs.map(([a, b]) => `'${a}' vs '${b}'`).join(", ")}.`
      : "";

  const visionContents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        {
          text:
            `This is my class timetable. My subjects are: ${subjectsLine}. Extract every class session for ` +
            "exactly these subjects, across every day shown, with their day, start time, end time, room, and " +
            `instructor where available. Leave room or instructor as an empty string if not shown.${similarPairsWarning}`,
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
              `${similarPairsWarning ? similarPairsWarning.trim() + " " : ""}Raw OCR text:\n\n${ocrText}`,
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
