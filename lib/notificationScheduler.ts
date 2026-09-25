import { prisma } from "@/lib/prisma";
import { qstashClient, getAppUrl } from "@/lib/qstash";
import { getIstDateParts, istMidnightUtc, istWallClockToUtc } from "@/lib/timezone";
import { computeHoursFromTimes } from "@/lib/attendanceUtils";

export interface ScheduleResult {
  scheduled: number;
  failed: number;
  skippedHolidayUsers: number;
}

/**
 * Enqueues one QStash message per class still to end today (IST), each set
 * to fire at that class's end time. Shared by the 5 AM daily cron (all
 * subscribed users) and by turning reminders on (just that user), so
 * someone who enables reminders mid-morning still gets today's remaining
 * classes instead of waiting until tomorrow.
 *
 * The deduplicationId makes this safe to run more than once a day for the
 * same user - QStash drops a second publish for the same class and date.
 */
export async function scheduleRemainingClassesToday(userIds?: string[]): Promise<ScheduleResult> {
  const { year, month, day, dayOfWeek } = getIstDateParts();
  const todayMidnight = istMidnightUtc(year, month, day);
  const tomorrowMidnight = new Date(todayMidnight.getTime() + 24 * 60 * 60 * 1000);
  const dateIso = todayMidnight.toISOString();
  const dateKey = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const now = Date.now();

  const targetUserIds: string[] =
    userIds ??
    (await prisma.pushSubscription
      .findMany({ select: { userId: true }, distinct: ["userId"] })
      .then((rows) => rows.map((r) => r.userId)));

  if (targetUserIds.length === 0) {
    return { scheduled: 0, failed: 0, skippedHolidayUsers: 0 };
  }

  // Calendar holidays are stored as the date string's UTC midnight
  // (new Date("YYYY-MM-DD")), so match on that calendar day, not IST.
  const holidayStart = new Date(Date.UTC(year, month - 1, day));
  const holidayEnd = new Date(holidayStart.getTime() + 24 * 60 * 60 * 1000);
  const holidayUserIds = new Set(
    (
      await prisma.calendarEvent.findMany({
        where: {
          userId: { in: targetUserIds },
          eventType: "holiday",
          dueDate: { gte: holidayStart, lt: holidayEnd },
        },
        select: { userId: true },
      })
    ).map((e) => e.userId)
  );

  const entries = await prisma.timetableEntry.findMany({
    where: {
      OR: [
        // Weekly classes on today's weekday, unless the student marked
        // today a holiday...
        {
          dayOfWeek,
          onDate: null,
          semester: {
            userId: { in: targetUserIds.filter((id) => !holidayUserIds.has(id)) },
            startDate: { lt: tomorrowMidnight },
            endDate: { gte: todayMidnight },
          },
        },
        // ...plus any one-time extra class scheduled for today (stored as
        // the date's UTC midnight, like holidays) - even on a holiday,
        // since the student added it on purpose.
        {
          onDate: { gte: holidayStart, lt: holidayEnd },
          semester: { userId: { in: targetUserIds } },
        },
      ],
    },
    include: { course: true, semester: { select: { userId: true } } },
  });

  const appUrl = getAppUrl();
  let scheduled = 0;
  let failed = 0;

  // One failed publish (network blip, rate limit) shouldn't cost every other
  // class today its reminder - keep going and report the count instead.
  for (const entry of entries) {
    const endsAt = istWallClockToUtc(year, month, day, entry.endTime);
    if (endsAt.getTime() <= now) continue;

    try {
      await qstashClient.publishJSON({
        url: `${appUrl}/api/notifications/deliver`,
        notBefore: Math.floor(endsAt.getTime() / 1000),
        deduplicationId: `${entry.id}-${dateKey}`,
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

  return { scheduled, failed, skippedHolidayUsers: holidayUserIds.size };
}
