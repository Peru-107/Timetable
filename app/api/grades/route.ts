import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { calculateCGPA } from "@/lib/calculations";
import { computeGradeFromMarks } from "@/lib/gradeScale";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const semesterId = req.nextUrl.searchParams.get("semesterId");

    const where: any = { userId: session.user.id };
    if (semesterId) where.semesterId = semesterId;

    const grades = await prisma.grade.findMany({
      where,
      include: { course: true },
    });

    const cgpaData = await calculateCGPA(session.user.id, semesterId || undefined);

    return NextResponse.json({ grades, cgpaData });
  } catch (error) {
    console.error("Error fetching grades:", error);
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

    const { courseId, semesterId, icaMarks, icaMax, teeMarks, teeMax } = await req.json();

    const resolvedIcaMax = icaMax ?? 50;
    const resolvedTeeMax = teeMax ?? 50;
    const { percentage, letterGrade, gradePoint } = computeGradeFromMarks(
      icaMarks ?? 0,
      resolvedIcaMax,
      teeMarks ?? 0,
      resolvedTeeMax
    );

    const data = {
      icaMarks,
      icaMax: resolvedIcaMax,
      teeMarks,
      teeMax: resolvedTeeMax,
      percentage,
      letterGrade,
      grade: gradePoint,
    };

    // Check if grade already exists
    const existingGrade = await prisma.grade.findUnique({
      where: { courseId },
    });

    if (existingGrade) {
      const updatedGrade = await prisma.grade.update({
        where: { courseId },
        data,
      });
      return NextResponse.json(updatedGrade);
    }

    const newGrade = await prisma.grade.create({
      data: {
        userId: session.user.id,
        courseId,
        semesterId,
        ...data,
      },
    });

    return NextResponse.json(newGrade, { status: 201 });
  } catch (error) {
    console.error("Error creating/updating grade:", error);
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

    const { id, icaMarks, icaMax, teeMarks, teeMax } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Grade ID required" }, { status: 400 });
    }

    const existing = await prisma.grade.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Grade not found" }, { status: 404 });
    }

    const resolvedIcaMax = icaMax ?? existing.icaMax;
    const resolvedTeeMax = teeMax ?? existing.teeMax;
    const resolvedIcaMarks = icaMarks ?? existing.icaMarks ?? 0;
    const resolvedTeeMarks = teeMarks ?? existing.teeMarks ?? 0;
    const { percentage, letterGrade, gradePoint } = computeGradeFromMarks(
      resolvedIcaMarks,
      resolvedIcaMax,
      resolvedTeeMarks,
      resolvedTeeMax
    );

    const updated = await prisma.grade.update({
      where: { id },
      data: {
        icaMarks: resolvedIcaMarks,
        icaMax: resolvedIcaMax,
        teeMarks: resolvedTeeMarks,
        teeMax: resolvedTeeMax,
        percentage,
        letterGrade,
        grade: gradePoint,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Error updating grade:", error);
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
      return NextResponse.json({ error: "Grade ID required" }, { status: 400 });
    }

    const existing = await prisma.grade.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Grade not found" }, { status: 404 });
    }

    await prisma.grade.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting grade:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
