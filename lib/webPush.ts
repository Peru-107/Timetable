import webpush from "web-push";
import { prisma } from "@/lib/prisma";

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT || "mailto:support@example.com",
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export interface AttendancePromptPayload {
  type: "attendance-prompt";
  title: string;
  body: string;
  timetableEntryId: string;
  courseId: string;
  date: string; // ISO date, midnight, matching AttendanceRecord.date
  hoursDuration: number;
}

/**
 * Sends one push message to every subscription a user has (they may have
 * several browsers/devices). A subscription the push service reports as
 * gone (410) or unknown (404) is deleted so we stop paying for it and stop
 * retrying it on the next class.
 */
export async function sendPushToUser(userId: string, payload: AttendancePromptPayload): Promise<void> {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify(payload)
        );
      } catch (error) {
        const statusCode = (error as { statusCode?: number } | undefined)?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
        } else {
          console.error(`Push send failed for subscription ${sub.id}:`, error);
        }
      }
    })
  );
}
