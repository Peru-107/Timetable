import { GoogleGenAI } from "@google/genai";

// Same model list/fallback pattern as lib/timetableExtraction.ts's vision
// path - gemini-2.5-flash is gone for new keys, so 3.6 is tried first as
// the likely-least-contended mid-tier model, then the flagship neighbors.
const VISION_MODELS = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"];

function isRetryableStatus(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  return status === 503 || status === 429 || status === 404;
}

const SYSTEM_INSTRUCTION =
  "You extract the readable text content from a student's study material (lecture notes, slides, a textbook " +
  "excerpt, or a photo of handwritten/whiteboard notes). Return the content as plain text, preserving headings, " +
  "bullet points, and paragraph structure where present. Do not summarize, comment on, or add anything not in " +
  "the source - transcribe it as faithfully as possible. If the file is unreadable or contains no meaningful " +
  "text, return an empty string.";

/** Extracts all readable text from a PDF or image via Gemini's native document understanding. */
export async function extractStudyMaterialText(
  fileBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const base64Data = fileBuffer.toString("base64");

  const contents = [
    {
      role: "user",
      parts: [
        { inlineData: { mimeType, data: base64Data } },
        { text: "Extract all readable text content from this document." },
      ],
    },
  ];

  let lastError: unknown;
  for (const model of VISION_MODELS) {
    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config: { systemInstruction: SYSTEM_INSTRUCTION },
      });
      return response.text?.trim() ?? "";
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
