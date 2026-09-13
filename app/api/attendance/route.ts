import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { calculateAttendanceStats } from "@/lib/calculations";

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
    if (semesterId) {
      stats = await calculateAttendanceStats(session.user.id, semesterId);
    }

    return NextResponse.json({ records, stats });
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

    const { courseId, date, status, hoursDuration, notes } = await req.json();

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

    // Marking the same class on the same day again updates the existing
    // record instead of creating a duplicate (this is how tap-to-mark on
    // the Timetable page behaves, and it makes re-submitting the manual
    // form for the same day safe too).
    const existing = await prisma.attendanceRecord.findFirst({
      where: {
        userId: session.user.id,
        courseId,
        date: { gte: dayStart, lte: dayEnd },
      },
    });

    const record = existing
      ? await prisma.attendanceRecord.update({
          where: { id: existing.id },
          data: { status, hoursDuration, notes },
        })
      : await prisma.attendanceRecord.create({
          data: {
            userId: session.user.id,
            courseId,
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
