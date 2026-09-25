import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { mergeAdjacentEntriesForCourse } from "@/lib/mergeAdjacentEntries";
import { computeHoursFromTimes } from "@/lib/attendanceUtils";
import { NextRequest, NextResponse } from "next/server";

/**
 * Copy a shared timetable's courses and weekly slots into one of the
 * caller's semesters. A course with the same name already there is reused,
 * and a slot that already exists is skipped, so importing twice is safe.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { token } = await ctx.params;
    const { semesterId } = await req.json();

    const target = await prisma.semester.findFirst({
      where: { id: semesterId, userId: session.user.id },
      include: { courses: { include: { timetableEntries: { where: { onDate: null } } } } },
    });
    if (!target) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }
    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        semester: {
          include: { courses: { include: { timetableEntries: { where: { onDate: null } } } } },
        },
      },
    });
    if (!link) {
      return NextResponse.json({ error: "This link has expired or been turned off" }, { status: 404 });
    }
    if (link.semesterId === target.id) {
      return NextResponse.json({ error: "That's already your own timetable" }, { status: 400 });
    }

    let coursesAdded = 0;
    let classesAdded = 0;
    for (const source of link.semester.courses) {
      let course = target.courses.find(
        (c) => c.name.trim().toLowerCase() === source.name.trim().toLowerCase()
      );
      if (!course) {
        const weeklyHours = source.timetableEntries.reduce(
          (sum, e) => sum + computeHoursFromTimes(e.startTime, e.endTime),
          0
        );
        const created = await prisma.course.create({
          data: {
            name: source.name,
            code: source.code,
            creditHours: weeklyHours > 0 ? weeklyHours : source.creditHours,
            semesterId: target.id,
          },
        });
        course = { ...created, timetableEntries: [] };
        coursesAdded++;
      }
      for (const e of source.timetableEntries) {
        const exists = course.timetableEntries.some(
          (x) => x.dayOfWeek === e.dayOfWeek && x.startTime === e.startTime && x.endTime === e.endTime
        );
        if (exists) continue;
        await prisma.timetableEntry.create({
          data: {
            courseId: course.id,
            semesterId: target.id,
            dayOfWeek: e.dayOfWeek,
            startTime: e.startTime,
            endTime: e.endTime,
            room: e.room,
            instructor: e.instructor,
          },
        });
        classesAdded++;
      }
      await mergeAdjacentEntriesForCourse(course.id);
    }

    return NextResponse.json({ coursesAdded, classesAdded });
  } catch (error) {
    console.error("Error importing shared timetable:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
