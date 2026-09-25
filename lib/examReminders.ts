import { prisma } from "./prisma";
import { sendPushToUser } from "./webPush";
import { getIstDateParts } from "./timezone";

/**
 * Morning heads-up for exams today and tomorrow, sent by the daily cron to
 * every student with reminders on. Calendar dates are stored as the picked
 * day's UTC midnight, so "today" is matched on the IST calendar date.
 */
export async function sendExamReminders(): Promise<{ sent: number }> {
  const { year, month, day } = getIstDateParts();
  const today = new Date(Date.UTC(year, month - 1, day));
  const dayAfterTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000);

  const subscribed = await prisma.pushSubscription.findMany({
    select: { userId: true },
    distinct: ["userId"],
  });
  if (subscribed.length === 0) return { sent: 0 };

  const exams = await prisma.calendarEvent.findMany({
    where: {
      userId: { in: subscribed.map((s) => s.userId) },
      eventType: "exam",
      completed: false,
      dueDate: { gte: today, lt: dayAfterTomorrow },
    },
    orderBy: { dueDate: "asc" },
  });

  let sent = 0;
  for (const exam of exams) {
    const isToday = exam.dueDate.getTime() === today.getTime();
    const dateKey = exam.dueDate.toISOString().slice(0, 10);
    const results = await sendPushToUser(exam.userId, {
      type: "reminder",
      title: isToday ? `Exam today: ${exam.title}` : `Exam tomorrow: ${exam.title}`,
      body: exam.description?.trim() || (isToday ? "All the best!" : "Time for a final revision."),
      tag: `exam-${exam.id}-${dateKey}-${isToday ? "day" : "eve"}`,
      url: `/dashboard/calendar?semesterId=${exam.semesterId}`,
    });
    if (results.some((r) => r.ok)) sent++;
  }
  return { sent };
}
