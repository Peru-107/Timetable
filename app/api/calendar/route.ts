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

    const where: any = { userId: session.user.id };
    if (semesterId) where.semesterId = semesterId;

    const events = await prisma.calendarEvent.findMany({
      where,
      orderBy: { dueDate: "asc" },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("Error fetching calendar events:", error);
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

    const { title, description, eventType, dueDate, endDate, semesterId } = await req.json();

    if (!title || !String(title).trim()) {
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }
    const start = new Date(dueDate);
    if (Number.isNaN(start.getTime())) {
      return NextResponse.json({ error: "A valid date is required" }, { status: 400 });
    }

    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId: session.user.id },
      select: { id: true },
    });
    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    // A holiday range (e.g. a week-long Diwali break) becomes one event per
    // day, so every per-day check - the calendar grid, "is today a holiday",
    // skipping reminders - keeps working off a single date.
    if (eventType === "holiday" && endDate) {
      const end = new Date(endDate);
      if (Number.isNaN(end.getTime()) || end < start) {
        return NextResponse.json({ error: "End date must be on or after the start date" }, { status: 400 });
      }
      const dayMs = 24 * 60 * 60 * 1000;
      const days = Math.round((end.getTime() - start.getTime()) / dayMs) + 1;
      if (days > 60) {
        return NextResponse.json({ error: "A holiday range can be at most 60 days" }, { status: 400 });
      }
      const created = await prisma.calendarEvent.createMany({
        data: Array.from({ length: days }, (_, i) => ({
          userId: session.user.id,
          semesterId,
          title: String(title).trim(),
          description,
          eventType,
          dueDate: new Date(start.getTime() + i * dayMs),
        })),
      });
      return NextResponse.json({ created: created.count }, { status: 201 });
    }

    const event = await prisma.calendarEvent.create({
      data: {
        userId: session.user.id,
        semesterId,
        title: String(title).trim(),
        description,
        eventType,
        dueDate: start,
      },
    });

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    console.error("Error creating calendar event:", error);
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

    const { id, title, description, eventType, dueDate, completed } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    const existing = await prisma.calendarEvent.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const updated = await prisma.calendarEvent.update({
      where: { id },
      data: {
        title,
        description,
        eventType,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        completed: typeof completed === "boolean" ? completed : undefined,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating calendar event:", error);
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
      return NextResponse.json({ error: "Event ID required" }, { status: 400 });
    }

    const existing = await prisma.calendarEvent.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    await prisma.calendarEvent.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting calendar event:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
