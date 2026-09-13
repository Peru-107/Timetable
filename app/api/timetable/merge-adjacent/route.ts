import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { mergeAdjacentEntriesForSemester } from "@/lib/mergeAdjacentEntries";

/**
 * One-time cleanup for data created before entries auto-merged on save
 * (e.g. an hourly-grid timetable scan that left a subject as three
 * separate hour-long entries instead of one 3-hour session).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { semesterId } = await req.json();
    if (!semesterId) {
      return NextResponse.json({ error: "Semester ID required" }, { status: 400 });
    }

    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId: session.user.id },
    });
    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }

    const mergedCount = await mergeAdjacentEntriesForSemester(semesterId);

    return NextResponse.json({ mergedCount });
  } catch (error) {
    console.error("Error merging adjacent timetable entries:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
