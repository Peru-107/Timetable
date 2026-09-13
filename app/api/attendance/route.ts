import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { calculateAttendanceStats } from "@/lib/calculations";

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

    const { courseId, date, isPresent, hoursDuration, notes } = await req.json();

    const record = await prisma.attendanceRecord.create({
      data: {
        userId: session.user.id,
        courseId,
        date: new Date(date),
        isPresent,
        hoursDuration,
        notes,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    console.error("Error creating attendance record:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
