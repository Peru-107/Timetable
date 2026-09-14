import { prisma } from "@/lib/prisma";
import { qstashClient, getAppUrl } from "@/lib/qstash";
import { getIstDateParts, istMidnightUtc, istWallClockToUtc } from "@/lib/timezone";
import { computeHoursFromTimes } from "@/lib/attendanceUtils";
import { NextRequest, NextResponse } from "next/server";

/**
 * Runs once a day (Vercel Hobby cron only allows daily schedules) early in
 * the IST morning. It doesn't send anything itself - it enqueues one QStash
 * message per class ending today, each set to fire at the exact IST end
 * time, so the actual notification lands within a minute of the class
 * ending regardless of cron's daily granularity.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const { year, month, day, dayOfWeek } = getIstDateParts();
    const dateIso = istMidnightUtc(year, month, day).toISOString();
    const now = Date.now();

    const subscribedUserIds = await prisma.pushSubscription
      .findMany({ select: { userId: true }, distinct: ["userId"] })
      .then((rows) => rows.map((r) => r.userId));

    if (subscribedUserIds.length === 0) {
      return NextResponse.json({ scheduled: 0 });
    }

    const todayMidnight = istMidnightUtc(year, month, day);
    const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);

    const entries = await prisma.timetableEntry.findMany({
      where: {
        dayOfWeek,
        semester: {
          userId: { in: subscribedUserIds },
          startDate: { lt: tomorrowMidnight },
          endDate: { gte: todayMidnight },
        },
      },
      include: { course: true, semester: { select: { userId: true } } },
    });

    const appUrl = getAppUrl();
    let scheduled = 0;
    let failed = 0;

    // One QStash call failing (network blip, rate limit) shouldn't cost
    // every other class today its notification - keep going and report
    // the failure count instead of aborting the whole run.
    for (const entry of entries) {
      const endsAt = istWallClockToUtc(year, month, day, entry.endTime);
      if (endsAt.getTime() <= now) continue; // already ended - don't fire a late notification

      try {
        await qstashClient.publishJSON({
          url: `${appUrl}/api/notifications/deliver`,
          notBefore: Math.floor(endsAt.getTime() / 1000),
          body: {
            userId: entry.semester.userId,
            timetableEntryId: entry.id,
            courseId: entry.courseId,
            courseName: entry.course.name,
            date: dateIso,
            hoursDuration: computeHoursFromTimes(entry.startTime, entry.endTime),
          },
        });
        scheduled += 1;
      } catch (error) {
        failed += 1;
        console.error(`Failed to schedule notification for entry ${entry.id}:`, error);
      }
    }

    return NextResponse.json({ scheduled, failed });
  } catch (error) {
    console.error("Error scheduling today's class-end notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
