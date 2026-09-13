import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { calculateAttendanceStats, calculateAttendanceStatsByCourse } from "@/lib/calculations";

const VALID_STATUSES = ["PRESENT", "ABSENT", "CANCELLED"];

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const semesterId = req.nextUrl.searchParams.get("semesterId");
    const courseId = req.nextUrl.searchParams.get("courseId");

    const where: any = { userId: session.user.id };
    if (courseId) where.courseId = courseId;

    let records = await prisma.attendanceRecord.findMany({
      where,
      include: { course: true },
      orderBy: { date: "desc" },
    });

    if (semesterId) {
      records = records.filter(
        (r) =>
          r.course.semesterId === semesterId
      );
    }

    // Get stats if semesterId provided
    let stats = null;
    let statsByCourse = null;
    if (semesterId) {
      stats = await calculateAttendanceStats(session.user.id, semesterId);
      statsByCourse = await calculateAttendanceStatsByCourse(session.user.id, semesterId);
    }

    return NextResponse.json({ records, stats, statsByCourse });
  } catch (error) {
    console.error("Error fetching attendance:", error);
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

    const { courseId, timetableEntryId, date, status, hoursDuration, notes } = await req.json();

    if (!VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const targetDate = new Date(date);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Attendance can only be marked for today or earlier. A day of slack
    // absorbs client/server timezone differences around "today" without
    // letting someone mark attendance for next week.
    if (dayStart.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
      return NextResponse.json(
        { error: "Cannot mark attendance for a future date" },
        { status: 400 }
      );
    }

    // Marking the same class session again updates its existing record
    // instead of creating a duplicate. A course can meet more than once on
    // the same day (e.g. a lecture and a tutorial), so identity has to
    // include which timetable entry the mark came from - courseId + date
    // alone would make the second session's mark overwrite the first's
    // instead of recording both.
    let existing = timetableEntryId
      ? await prisma.attendanceRecord.findFirst({
          where: {
            userId: session.user.id,
            courseId,
            date: { gte: dayStart, lte: dayEnd },
            timetableEntryId,
          },
        })
      : await prisma.attendanceRecord.findFirst({
          where: {
            userId: session.user.id,
            courseId,
            date: { gte: dayStart, lte: dayEnd },
          },
        });

    if (!existing && timetableEntryId) {
      // No record tagged for this exact slot. If this course doesn't
      // already have a record for a DIFFERENT slot today, treat any
      // untagged same-day record as this slot instead of duplicating it -
      // this covers manual entries and records created before per-slot
      // tracking existed. A record already tagged for another slot means
      // the course genuinely meets twice today, so leave it alone and
      // create a new one below.
      const sameDayForCourse = await prisma.attendanceRecord.findFirst({
        where: { userId: session.user.id, courseId, date: { gte: dayStart, lte: dayEnd } },
      });
      if (sameDayForCourse && sameDayForCourse.timetableEntryId === null) {
        existing = sameDayForCourse;
      }
    }

    const record = existing
      ? await prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: { status, hoursDuration, notes, timetableEntryId: timetableEntryId ?? null },
        })
      : await prisma.attendanceRecord.create({
          data: {
            userId: session.user.id,
            courseId,
            timetableEntryId: timetableEntryId ?? null,
            date: targetDate,
            status,
            hoursDuration,
            notes,
          },
        });

    return NextResponse.json(record, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error("Error creating attendance record:", error);
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

    const { id, status, hoursDuration, notes } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Record ID required" }, { status: 400 });
    }
    if (status && !VALID_STATUSES.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const existing = await prisma.attendanceRecord.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    const updated = await prisma.attendanceRecord.update({
      where: { id },
      data: { status, hoursDuration, notes },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating attendance record:", error);
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
      return NextResponse.json({ error: "Record ID required" }, { status: 400 });
    }

    const existing = await prisma.attendanceRecord.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    await prisma.attendanceRecord.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting attendance record:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
