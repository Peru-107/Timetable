import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";

const ExtractionSchema = z.object({
  courses: z
    .array(
      z.object({
        code: z
          .string()
          .describe("Short subject code exactly as shown in the timetable, e.g. 'IA 3'"),
        name: z
          .string()
          .describe(
            "Full subject name from the legend/key if one is present (e.g. 'Investment Analysis'), otherwise the same as code"
          ),
      })
    )
    .describe("One entry per distinct subject code that appears in entries[]"),
  entries: z
    .array(
      z.object({
        subjectCode: z
          .string()
          .describe("Must exactly match one of the codes in courses[].code"),
        dayOfWeek: z
          .number()
          .int()
          .min(0)
          .max(6)
          .describe("0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday"),
        startTime: z.string().describe("24-hour HH:MM, e.g. '09:00'"),
        endTime: z.string().describe("24-hour HH:MM, e.g. '11:00'"),
        room: z.string().optional().describe("Room or venue code if shown"),
        instructor: z.string().optional().describe("Instructor name or initials if shown"),
      })
    )
    .describe("One entry per class session found for the requested subjects"),
});

export type TimetableExtraction = z.infer<typeof ExtractionSchema>;

/**
 * Master university timetables often show several parallel elective
 * sections in the same slot (e.g. two electives side by side on the same
 * day/time). We ask Claude to read the table visually and keep only the
 * sessions matching the student's own subjects, since plain OCR text has no
 * sense of table structure and can't tell which subject belongs to which
 * cell in that layout.
 */
export async function extractTimetable(
  fileBuffer: Buffer,
  mimeType: string,
  subjectCodes: string[]
): Promise<TimetableExtraction> {
  const client = new Anthropic();
  const base64Data = fileBuffer.toString("base64");

  const documentBlock =
    mimeType === "application/pdf"
      ? ({
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: base64Data },
        } as const)
      : ({
          type: "image",
          source: {
            type: "base64",
            media_type: mimeType as "image/jpeg" | "image/png",
            data: base64Data,
          },
        } as const);

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 8000,
    thinking: { type: "adaptive" },
    system:
      "You read university class timetable images or PDFs and extract a student's personal schedule from them. " +
      "These timetables frequently list several parallel elective sections in the same day/time slot (e.g. two " +
      "different subjects shown side by side in the same cell or column) because they cover an entire cohort, not " +
      "one student. Only extract sessions for the specific subjects the student tells you they take - ignore every " +
      "other subject shown on the sheet, even if it appears in the same time slot. Match subject codes loosely: " +
      "ignore differences in spacing, case, and punctuation (e.g. 'IB3' matches 'IB 3'). If the sheet includes a " +
      "legend or key mapping short codes to full subject names, use it to fill in full names; otherwise reuse the " +
      "code as the name. Convert all times to 24-hour HH:MM format.",
    messages: [
      {
        role: "user",
        content: [
          documentBlock,
          {
            type: "text",
            text:
              "This is my class timetable. My subjects are: " +
              subjectCodes.join(", ") +
              ". Extract every class session for exactly these subjects, across every day shown, with their day, " +
              "start time, end time, room, and instructor where available.",
          },
        ],
      },
    ],
    output_config: {
      format: zodOutputFormat(ExtractionSchema),
      effort: "high",
    },
  });

  if (!response.parsed_output) {
    throw new Error("Could not parse a schedule from this file");
  }

  return response.parsed_output;
}
