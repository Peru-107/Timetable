import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { mergeAdjacentEntriesForCourse } from "@/lib/mergeAdjacentEntries";

/**
 * Without this, a bad dayOfWeek (e.g. from a malformed request) silently
 * creates an entry the Timetable UI can never show or delete - it only ever
 * renders days 0-6 - while attendance stats keep counting its hours forever.
 * An inverted time range hits the same "invisible corruption" pattern: it
 * doesn't error, it just silently becomes a fake 1-hour class via
 * computeHoursFromTimes's fallback (lib/attendanceUtils.ts).
 */
function validateEntryTimes(dayOfWeek: unknown, startTime: string, endTime: string): string | null {
  if (typeof dayOfWeek !== "number" || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
    return "Day of week must be between Sunday (0) and Saturday (6)";
  }
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) {
    return "Start and end time are required";
  }
  if (eh * 60 + em <= sh * 60 + sm) {
    return "End time must be after start time";
  }
  return null;
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const semesterId = req.nextUrl.searchParams.get("semesterId");
    if (!semesterId) {
      return NextResponse.json(
        { error: "Semester ID required" },
        { status: 400 }
      );
    }

    const entries = await prisma.timetableEntry.findMany({
      where: { semesterId },
      include: { course: true },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error("Error fetching timetable:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { courseId, startTime, endTime, room, instructor } = body;

    // The course must be the caller's own; the entry always goes in that
    // course's semester.
    const course = await prisma.course.findFirst({
      where: { id: courseId, semester: { userId: session.user.id } },
      select: { id: true, semesterId: true },
    });
    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // A one-time extra / make-up class: "YYYY-MM-DD", stored as that date's
    // UTC midnight (same convention as calendar events), and its weekday
    // derived from it.
    let onDate: Date | null = null;
    let dayOfWeek = body.dayOfWeek;
    if (body.onDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.onDate))) {
        return NextResponse.json({ error: "Pick a valid date for the extra class" }, { status: 400 });
      }
      onDate = new Date(`${body.onDate}T00:00:00.000Z`);
      if (Number.isNaN(onDate.getTime())) {
        return NextResponse.json({ error: "Pick a valid date for the extra class" }, { status: 400 });
      }
      dayOfWeek = onDate.getUTCDay();
    }

    const validationError = validateEntryTimes(dayOfWeek, startTime, endTime);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const entry = await prisma.timetableEntry.create({
      data: {
        courseId,
        semesterId: course.semesterId,
        dayOfWeek,
        startTime,
        endTime,
        room,
        instructor,
        onDate,
      },
    });

    if (onDate) {
      return NextResponse.json(entry, { status: 201 });
    }

    // If this entry is back-to-back with another entry for the same course
    // on the same day, collapse them into one continuous session - this
    // row's id may not survive that (it can get merged into an earlier one).
    const mergedCount = await mergeAdjacentEntriesForCourse(courseId);
    const result = mergedCount > 0
      ? (await prisma.timetableEntry.findUnique({ where: { id: entry.id } })) ??
        (await prisma.timetableEntry.findFirst({ where: { courseId, dayOfWeek, onDate: null } }))
      : entry;

    return NextResponse.json(result ?? entry, { status: 201 });
  } catch (error) {
    console.error("Error creating timetable entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { id, courseId, startTime, endTime, room, instructor } = body;
    let dayOfWeek = body.dayOfWeek;
    if (!id) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    const existing = await prisma.timetableEntry.findFirst({
      where: { id, semester: { userId: session.user.id } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Timetable entry not found" }, { status: 404 });
    }

    if (courseId && courseId !== existing.courseId) {
      const owned = await prisma.course.findFirst({
        where: { id: courseId, semester: { userId: session.user.id } },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json({ error: "Course not found" }, { status: 404 });
      }
    }

    // An extra class can move to another date; its weekday follows the date.
    let onDate: Date | null | undefined = undefined;
    if (existing.onDate) {
      if (body.onDate && /^\d{4}-\d{2}-\d{2}$/.test(String(body.onDate))) {
        onDate = new Date(`${body.onDate}T00:00:00.000Z`);
      }
      dayOfWeek = (onDate ?? existing.onDate).getUTCDay();
    }

    const validationError = validateEntryTimes(dayOfWeek, startTime, endTime);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const updated = await prisma.timetableEntry.update({
      where: { id },
      data: { courseId, dayOfWeek, startTime, endTime, room, instructor, onDate },
    });

    if (updated.onDate) {
      return NextResponse.json(updated);
    }

    const mergedCount = await mergeAdjacentEntriesForCourse(updated.courseId);
    const result = mergedCount > 0
      ? (await prisma.timetableEntry.findUnique({ where: { id: updated.id } })) ??
        (await prisma.timetableEntry.findFirst({
          where: { courseId: updated.courseId, dayOfWeek: updated.dayOfWeek, onDate: null },
        }))
      : updated;

    return NextResponse.json(result ?? updated);
  } catch (error) {
    console.error("Error updating timetable entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    const existing = await prisma.timetableEntry.findFirst({
      where: { id, semester: { userId: session.user.id } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Timetable entry not found" }, { status: 404 });
    }

    await prisma.timetableEntry.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting timetable entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
