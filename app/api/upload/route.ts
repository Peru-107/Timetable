import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { extractTimetable } from "@/lib/timetableExtraction";

// Vision extraction on a detailed table image can take a while, and a
// fallback path (OCR + a second model call) can run after it; give this
// more room than the platform default before the function is killed.
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
    const subjectsRaw = formData.get("subjects") as string | null;

    if (!file || !semesterId) {
      return NextResponse.json(
        { error: "File and semester ID required" },
        { status: 400 }
      );
    }

    const subjectCodes = (subjectsRaw || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    if (subjectCodes.length === 0) {
      return NextResponse.json(
        { error: "List at least one subject to extract" },
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

    const fileType = file.type === "application/pdf" ? "pdf" : "image";
    const upload = await prisma.timetableUpload.create({
      data: {
        semesterId,
        uploadUrl: `upload:${file.name}`,
        fileType,
        status: "processing",
      },
    });

    try {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const extraction = await extractTimetable(fileBuffer, file.type, subjectCodes);

      const existingCourses = await prisma.course.findMany({
        where: { semesterId },
      });

      const codeToCourseId = new Map<string, string>();
      for (const parsedCourse of extraction.courses) {
        const normalizedCode = parsedCourse.code.trim().toLowerCase();
        const match = existingCourses.find(
          (c) =>
            c.name.trim().toLowerCase() === parsedCourse.name.trim().toLowerCase() ||
            (c.code && c.code.trim().toLowerCase() === normalizedCode)
        );

        if (match) {
          codeToCourseId.set(normalizedCode, match.id);
        } else {
          const created = await prisma.course.create({
            data: {
              name: parsedCourse.name || parsedCourse.code,
              code: parsedCourse.code,
              semesterId,
            },
          });
          existingCourses.push(created);
          codeToCourseId.set(normalizedCode, created.id);
        }
      }

      const existingEntries = await prisma.timetableEntry.findMany({
        where: { semesterId },
      });

      let createdCount = 0;
      for (const entry of extraction.entries) {
        const courseId = codeToCourseId.get(entry.subjectCode.trim().toLowerCase());
        if (!courseId) continue;

        const isDuplicate = existingEntries.some(
          (e) =>
            e.courseId === courseId &&
            e.dayOfWeek === entry.dayOfWeek &&
            e.startTime === entry.startTime &&
            e.endTime === entry.endTime
        );
        if (isDuplicate) continue;

        await prisma.timetableEntry.create({
          data: {
            courseId,
            semesterId,
            dayOfWeek: entry.dayOfWeek,
            startTime: entry.startTime,
            endTime: entry.endTime,
            room: entry.room,
            instructor: entry.instructor,
          },
        });
        createdCount++;
      }

      // Credit hours track weekly scheduled hours (1 hour/week = 1 credit),
      // so recompute them from each affected course's full timetable now
      // that this scan's classes are in.
      const affectedCourseIds = Array.from(new Set(codeToCourseId.values()));
      for (const courseId of affectedCourseIds) {
        const courseEntries = await prisma.timetableEntry.findMany({
          where: { courseId },
        });
        const totalMinutes = courseEntries.reduce((sum, e) => {
          const [sh, sm] = e.startTime.split(":").map(Number);
          const [eh, em] = e.endTime.split(":").map(Number);
          const minutes = eh * 60 + em - (sh * 60 + sm);
          return sum + (minutes > 0 ? minutes : 0);
        }, 0);
        const creditHours = Math.max(0.5, Math.round((totalMinutes / 60) * 2) / 2);
        await prisma.course.update({
          where: { id: courseId },
          data: { creditHours },
        });
      }

      await prisma.timetableUpload.update({
        where: { id: upload.id },
        data: {
          status: "completed",
          extractedText: JSON.stringify(extraction),
        },
      });

      return NextResponse.json(
        {
          message: `Added ${createdCount} class${createdCount === 1 ? "" : "es"} to your timetable`,
          uploadId: upload.id,
          entriesFound: extraction.entries.length,
          entriesCreated: createdCount,
        },
        { status: 201 }
      );
    } catch (extractionError) {
      console.error("Timetable extraction error:", extractionError);
      await prisma.timetableUpload.update({
        where: { id: upload.id },
        data: { status: "failed" },
      });
      return NextResponse.json(
        { error: "Could not read a schedule from this file. Try a clearer scan or add entries manually." },
        { status: 422 }
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
