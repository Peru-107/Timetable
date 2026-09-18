import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { createWorker } from "tesseract.js";

// Same model fallback chain as lib/timetableExtraction.ts - gemini-2.5-flash
// is no longer available to new API keys at all (404, not transient).
const VISION_MODELS = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"];
const TEXT_FALLBACK_MODELS = ["gemini-3.6-flash", "gemini-3.7-flash"];

function isRetryableStatus(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  return status === 503 || status === 429 || status === 404;
}

export interface HolidayExtraction {
  holidays: Array<{ title: string; date: string }>;
}

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    holidays: {
      type: Type.ARRAY,
      description: "One entry per holiday, academic break, or no-class day listed on the sheet",
      items: {
        type: Type.OBJECT,
        properties: {
          title: {
            type: Type.STRING,
            description: "The holiday or occasion name exactly as shown, e.g. 'Diwali' or 'Republic Day'",
          },
          date: {
            type: Type.STRING,
            description: "The date in YYYY-MM-DD format, using the given reference year if the sheet doesn't show one",
          },
        },
        required: ["title", "date"],
      },
    },
  },
  required: ["holidays"],
};

const SHARED_RULES =
  "This is an academic holiday list or vacation calendar issued by a university/institute. Extract every " +
  "named holiday, festival, or no-class day, along with its date. Skip generic weekly off-days (e.g. a row " +
  "that just says 'every Sunday') unless a specific date is given. If a date range is given for one holiday " +
  "(e.g. a multi-day festival break), list it as separate entries, one per calendar day in the range, all " +
  "sharing that holiday's title.";

const SYSTEM_INSTRUCTION_VISION = "You read an image or PDF of a university holiday list. " + SHARED_RULES;
const SYSTEM_INSTRUCTION_TEXT_FALLBACK =
  "You read raw OCR text extracted from a photo of a university holiday list and reconstruct the holiday " +
  "dates from it, using layout clues to cope with any scrambled row/column order OCR introduced. " +
  SHARED_RULES;

async function ocrExtractText(fileBuffer: Buffer): Promise<string> {
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

export async function extractHolidays(
  fileBuffer: Buffer,
  mimeType: string,
  referenceYear: number
): Promise<HolidayExtraction> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const base64Data = fileBuffer.toString("base64");

  const visionContents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        {
          text:
            "This is my institute's holiday list. Extract every holiday and its date. If a date has no year " +
            `printed on it, use ${referenceYear} as the year.`,
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
              "This is OCR text extracted from a photo of my institute's holiday list. Extract every holiday " +
              `and its date. If a date has no year printed on it, use ${referenceYear} as the year. Raw OCR ` +
              `text:\n\n${ocrText}`,
          },
        ],
      },
    ];
    response = await callGemini(client, TEXT_FALLBACK_MODELS, textContents, SYSTEM_INSTRUCTION_TEXT_FALLBACK);
  }

  const text = response.text;
  if (!text) {
    throw new Error("Could not parse a holiday list from this file");
  }

  const parsed = JSON.parse(text) as HolidayExtraction;
  return { holidays: parsed.holidays };
}
