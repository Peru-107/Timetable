import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/**
 * Public, read-only view of a shared weekly timetable. Only course names
 * and weekly slots are exposed - never attendance, grades, email or the
 * owner's one-time extra classes.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    const link = await prisma.shareLink.findUnique({
      where: { token },
      include: {
        user: { select: { name: true } },
        semester: {
          select: {
            name: true,
            courses: {
              select: {
                name: true,
                timetableEntries: {
                  where: { onDate: null },
                  select: { dayOfWeek: true, startTime: true, endTime: true, room: true, instructor: true },
                  orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
                },
              },
              orderBy: { name: "asc" },
            },
          },
        },
      },
    });
    if (!link) {
      return NextResponse.json({ error: "This link has expired or been turned off" }, { status: 404 });
    }
    return NextResponse.json({
      semesterName: link.semester.name,
      // First name only - enough for "Shared by Aarav".
      sharedBy: link.user.name?.split(/\s+/)[0] || null,
      courses: link.semester.courses,
    });
  } catch (error) {
    console.error("Error reading share link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
