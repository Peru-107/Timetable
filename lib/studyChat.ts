import { GoogleGenAI } from "@google/genai";

// Same model list/fallback pattern used elsewhere for Gemini calls in this
// app (lib/timetableExtraction.ts, lib/studyMaterialExtraction.ts).
const CHAT_MODELS = ["gemini-3.6-flash", "gemini-3.7-flash", "gemini-3.8-flash"];

function isRetryableStatus(error: unknown): boolean {
  const status = (error as { status?: number } | undefined)?.status;
  return status === 503 || status === 429 || status === 404;
}

// Keeps a handful of real PDFs' worth of text comfortably under the
// model's context window while leaving room for chat history and the
// question itself. Materials are truncated in upload order once the
// budget runs out, rather than failing the request outright.
const MAX_CONTEXT_CHARS = 60000;

export interface StudyMaterialContext {
  fileName: string;
  courseName?: string; // included for the cross-subject scope, so the model can say which subject something came from
  extractedText: string;
}

export interface ChatHistoryMessage {
  role: "user" | "assistant";
  content: string;
}

function buildContextBlock(materials: StudyMaterialContext[]): string {
  let budget = MAX_CONTEXT_CHARS;
  const parts: string[] = [];
  for (const m of materials) {
    if (budget <= 0) break;
    const label = m.courseName ? `${m.courseName} - ${m.fileName}` : m.fileName;
    const text = m.extractedText.slice(0, budget);
    parts.push(`--- ${label} ---\n${text}`);
    budget -= text.length;
  }
  return parts.join("\n\n");
}

function buildSystemInstruction(contextBlock: string, useWebSearch: boolean): string {
  const materialInstruction = contextBlock
    ? "Answer primarily from the study material below. When an answer draws on a specific file, say so " +
      'naturally in the answer (e.g. "According to Unit3_Motivation.pdf..."). '
    : "No study material has been uploaded for this yet. ";

  const scopeInstruction = useWebSearch
    ? "You may also use general knowledge and web search to fill gaps or add context beyond the material, " +
      "but make clear when you're doing that rather than drawing on the uploaded material."
    : "Stick to the uploaded material only. If it doesn't cover the question, say so plainly instead of " +
      "guessing or reaching for outside knowledge.";

  const base =
    "You are a study assistant helping a student review their own uploaded course material. Be concise and " +
    "direct, like a knowledgeable classmate explaining a concept, not a textbook. " +
    materialInstruction +
    scopeInstruction;

  return contextBlock ? `${base}\n\nSTUDY MATERIAL:\n${contextBlock}` : base;
}

export async function answerStudyQuestion(
  question: string,
  materials: StudyMaterialContext[],
  history: ChatHistoryMessage[],
  useWebSearch: boolean
): Promise<string> {
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const contextBlock = buildContextBlock(materials);
  const systemInstruction = buildSystemInstruction(contextBlock, useWebSearch);

  const contents = [
    ...history.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    { role: "user", parts: [{ text: question }] },
  ];

  let lastError: unknown;
  for (const model of CHAT_MODELS) {
    try {
      const response = await client.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          ...(useWebSearch ? { tools: [{ googleSearch: {} }] } : {}),
        },
      });
      return (
        response.text?.trim() || "I couldn't come up with an answer - try rephrasing the question."
      );
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
