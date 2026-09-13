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

    const { name, startDate, endDate } = await req.json();

    const semester = await prisma.semester.create({
      data: {
        name,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
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
