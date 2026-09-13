import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { mergeAdjacentEntriesForCourse } from "@/lib/mergeAdjacentEntries";

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

    // If this entry is back-to-back with another entry for the same course
    // on the same day, collapse them into one continuous session - this
    // row's id may not survive that (it can get merged into an earlier one).
    const mergedCount = await mergeAdjacentEntriesForCourse(courseId);
    const result = mergedCount > 0
      ? (await prisma.timetableEntry.findUnique({ where: { id: entry.id } })) ??
        (await prisma.timetableEntry.findFirst({ where: { courseId, dayOfWeek } }))
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

    const { id, courseId, dayOfWeek, startTime, endTime, room, instructor } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Entry ID required" }, { status: 400 });
    }

    const existing = await prisma.timetableEntry.findFirst({
      where: { id, semester: { userId: session.user.id } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Timetable entry not found" }, { status: 404 });
    }

    const updated = await prisma.timetableEntry.update({
      where: { id },
      data: { courseId, dayOfWeek, startTime, endTime, room, instructor },
    });

    const mergedCount = await mergeAdjacentEntriesForCourse(updated.courseId);
    const result = mergedCount > 0
      ? (await prisma.timetableEntry.findUnique({ where: { id: updated.id } })) ??
        (await prisma.timetableEntry.findFirst({
          where: { courseId: updated.courseId, dayOfWeek: updated.dayOfWeek },
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
