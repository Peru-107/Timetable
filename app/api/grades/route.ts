import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { calculateCGPA } from "@/lib/calculations";

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

    const { courseId, grade, percentage, semesterId } = await req.json();

    // Check if grade already exists
    const existingGrade = await prisma.grade.findUnique({
      where: { courseId },
    });

    if (existingGrade) {
      // Update existing grade
      const updatedGrade = await prisma.grade.update({
        where: { courseId },
        data: { grade, percentage },
      });
      return NextResponse.json(updatedGrade);
    }

    // Create new grade
    const newGrade = await prisma.grade.create({
      data: {
        userId: session.user.id,
        courseId,
        grade,
        percentage,
        semesterId,
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
