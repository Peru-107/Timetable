import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * A non-positive creditHours doesn't just look wrong - it flips the sign of
 * that course's contribution to calculateCGPA's weighted average (or can
 * zero out the whole denominator), silently producing a nonsensical CGPA
 * for every course, not just this one.
 */
function validateCreditHours(creditHours: unknown): string | null {
  if (creditHours === undefined || creditHours === null) return null;
  if (typeof creditHours !== "number" || !Number.isFinite(creditHours) || creditHours <= 0) {
    return "Credit hours must be a positive number";
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

    const courses = await prisma.course.findMany({
      where: { semesterId },
      include: { timetableEntries: true },
    });

    return NextResponse.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
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

    const { name, code, creditHours, semesterId } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Course name is required" }, { status: 400 });
    }
    const creditError = validateCreditHours(creditHours);
    if (creditError) {
      return NextResponse.json({ error: creditError }, { status: 400 });
    }

    const course = await prisma.course.create({
      data: {
        name,
        code,
        creditHours,
        semesterId,
      },
    });

    return NextResponse.json(course, { status: 201 });
  } catch (error) {
    console.error("Error creating course:", error);
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

    const { id, name, code, creditHours } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Course ID required" }, { status: 400 });
    }

    const existing = await prisma.course.findFirst({
      where: { id, semester: { userId: session.user.id } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: "Course name is required" }, { status: 400 });
    }
    const creditError = validateCreditHours(creditHours);
    if (creditError) {
      return NextResponse.json({ error: creditError }, { status: 400 });
    }

    const updated = await prisma.course.update({
      where: { id },
      data: { name, code, creditHours },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating course:", error);
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
      return NextResponse.json({ error: "Course ID required" }, { status: 400 });
    }

    const existing = await prisma.course.findFirst({
      where: { id, semester: { userId: session.user.id } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    await prisma.course.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting course:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
