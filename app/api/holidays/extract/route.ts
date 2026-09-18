import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractHolidays } from "@/lib/holidayExtraction";

// Same rationale as app/api/upload/route.ts: vision extraction plus a
// possible OCR fallback pass can take a while.
export const maxDuration = 90;

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File;
    const semesterId = formData.get("semesterId") as string;

    if (!file || !semesterId) {
      return NextResponse.json(
        { error: "File and semester ID required" },
        { status: 400 }
      );
    }

    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId: session.user.id },
    });
    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    const allowedTypes = ["application/pdf", "image/jpeg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, JPEG, and PNG files are allowed" },
        { status: 400 }
      );
    }

    try {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const referenceYear = semester.startDate.getFullYear();
      const extraction = await extractHolidays(fileBuffer, file.type, referenceYear);

      // Extraction only - nothing is written to the calendar yet. The
      // student reviews and picks which of these to actually add, since an
      // institute-wide holiday list may include days that don't apply to
      // every program, or the model may misread a date.
      return NextResponse.json({ holidays: extraction.holidays });
    } catch (extractionError) {
      console.error("Holiday extraction error:", extractionError);
      return NextResponse.json(
        { error: "Could not read a holiday list from this file. Try a clearer scan." },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error("Holiday upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
