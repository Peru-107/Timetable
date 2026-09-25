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

    const semesters = await prisma.semester.findMany({
      where: { userId: session.user.id },
      include: {
        courses: true,
        timetableEntries: true,
      },
      orderBy: { startDate: "desc" },
    });

    return NextResponse.json(semesters);
  } catch (error) {
    console.error("Error fetching semesters:", error);
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

    const { name, startDate, endDate, weeks, minAttendance } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Semester name is required" }, { status: 400 });
    }
    const parsedStart = new Date(startDate);
    const parsedEnd = new Date(endDate);
    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return NextResponse.json({ error: "Valid start and end dates are required" }, { status: 400 });
    }
    if (parsedEnd <= parsedStart) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    const semester = await prisma.semester.create({
      data: {
        name,
        startDate: parsedStart,
        endDate: parsedEnd,
        weeks: weeks != null ? Math.max(1, Math.round(weeks)) : undefined,
        minAttendance:
          minAttendance != null ? Math.min(100, Math.max(1, Math.round(minAttendance))) : undefined,
        userId: session.user.id,
      },
    });

    return NextResponse.json(semester, { status: 201 });
  } catch (error) {
    console.error("Error creating semester:", error);
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

    const { id, name, startDate, endDate, weeks, minAttendance } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Semester ID required" }, { status: 400 });
    }

    const existing = await prisma.semester.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: "Semester name is required" }, { status: 400 });
    }

    const parsedStart = startDate ? new Date(startDate) : existing.startDate;
    const parsedEnd = endDate ? new Date(endDate) : existing.endDate;
    if (Number.isNaN(parsedStart.getTime()) || Number.isNaN(parsedEnd.getTime())) {
      return NextResponse.json({ error: "Valid start and end dates are required" }, { status: 400 });
    }
    if (parsedEnd <= parsedStart) {
      return NextResponse.json({ error: "End date must be after start date" }, { status: 400 });
    }

    const updated = await prisma.semester.update({
      where: { id },
      data: {
        name,
        startDate: startDate ? parsedStart : undefined,
        endDate: endDate ? parsedEnd : undefined,
        weeks: weeks != null ? Math.max(1, Math.round(weeks)) : undefined,
        minAttendance:
          minAttendance != null ? Math.min(100, Math.max(1, Math.round(minAttendance))) : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating semester:", error);
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
      return NextResponse.json({ error: "Semester ID required" }, { status: 400 });
    }

    const existing = await prisma.semester.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    // Cascades to courses, timetable entries, grades, and calendar events
    // for this semester (see schema onDelete: Cascade).
    await prisma.semester.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting semester:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
