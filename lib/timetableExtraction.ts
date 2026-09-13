import { GoogleGenAI } from "@google/genai";

// Newest model first; fall back to an older, less contended Flash model if
// the primary one is transiently overloaded (503 UNAVAILABLE / 429).
const MODELS_IN_PRIORITY_ORDER = ["gemini-3.8-flash", "gemini-2.5-flash"];

function isRetryableStatus(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  return status === 503 || status === 429;
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

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    courses: {
      type: "array",
      description: "One entry per distinct subject code that appears in entries[]",
      items: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "Short subject code exactly as shown in the timetable, e.g. 'IA 3'",
          },
          name: {
            type: "string",
            description:
              "Full subject name from the legend/key if one is present (e.g. 'Investment Analysis'), otherwise the same as code",
          },
        },
        required: ["code", "name"],
      },
    },
    entries: {
      type: "array",
      description: "One entry per class session found for the requested subjects",
      items: {
        type: "object",
        properties: {
          subjectCode: {
            type: "string",
            description: "Must exactly match one of the codes in courses[].code",
          },
          dayOfWeek: {
            type: "integer",
            description:
              "0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday",
          },
          startTime: { type: "string", description: "24-hour HH:MM, e.g. '09:00'" },
          endTime: { type: "string", description: "24-hour HH:MM, e.g. '11:00'" },
          room: { type: "string", description: "Room or venue code if shown, else empty string" },
          instructor: {
            type: "string",
            description: "Instructor name or initials if shown, else empty string",
          },
        },
        required: ["subjectCode", "dayOfWeek", "startTime", "endTime", "room", "instructor"],
      },
    },
  },
  required: ["courses", "entries"],
} as const;

/**
 * Master university timetables often show several parallel elective
 * sections in the same slot (e.g. two electives side by side on the same
 * day/time). We ask Gemini to read the table visually and keep only the
 * sessions matching the student's own subjects, since plain OCR text has no
 * sense of table structure and can't tell which subject belongs to which
 * cell in that layout.
 */
export async function extractTimetable(
  fileBuffer: Buffer,
  mimeType: string,
  subjectCodes: string[]
): Promise<TimetableExtraction> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const base64Data = fileBuffer.toString("base64");

  const contents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        {
          text:
            "This is my class timetable. My subjects are: " +
            subjectCodes.join(", ") +
            ". Extract every class session for exactly these subjects, across every day shown, with their day, " +
            "start time, end time, room, and instructor where available. Leave room or instructor as an empty " +
            "string if not shown.",
        },
      ],
    },
  ];

  const config = {
    systemInstruction:
      "You read university class timetable images or PDFs and extract a student's personal schedule from them. " +
      "These timetables frequently list several parallel elective sections in the same day/time slot (e.g. two " +
      "different subjects shown side by side in the same cell or column) because they cover an entire cohort, " +
      "not one student. Only extract sessions for the specific subjects the student tells you they take - ignore " +
      "every other subject shown on the sheet, even if it appears in the same time slot. Match subject codes " +
      "loosely: ignore differences in spacing, case, and punctuation (e.g. 'IB3' matches 'IB 3'). If the sheet " +
      "includes a legend or key mapping short codes to full subject names, use it to fill in full names; " +
      "otherwise reuse the code as the name. Convert all times to 24-hour HH:MM format.",
    responseMimeType: "application/json",
    responseSchema: RESPONSE_SCHEMA,
  };

  let lastError: unknown;
  let response: Awaited<ReturnType<typeof client.models.generateContent>> | undefined;

  outer: for (const model of MODELS_IN_PRIORITY_ORDER) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        response = await client.models.generateContent({ model, contents, config });
        break outer;
      } catch (error) {
        lastError = error;
        if (!isRetryableStatus(error)) {
          throw error;
        }
        if (attempt === 0) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      }
    }
  }

  if (!response) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Gemini is temporarily unavailable. Please try again shortly.");
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
