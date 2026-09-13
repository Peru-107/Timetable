import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

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

    const { courseId, semesterId, dayOfWeek, startTime, endTime, room, instructor } = await req.json();

    const entry = await prisma.timetableEntry.create({
      data: {
        courseId,
        semesterId,
        dayOfWeek,
        startTime,
        endTime,
        room,
        instructor,
      },
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error) {
    console.error("Error creating timetable entry:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
