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

export interface TestPayload {
  type: "test";
  title: string;
  body: string;
}

export type PushPayload = AttendancePromptPayload | TestPayload;

export interface PushSendResult {
  subscriptionId: string;
  ok: boolean;
  statusCode?: number;
  /** Push service rejected it as expired/unknown - the row was deleted. */
  removed?: boolean;
  error?: string;
}

/**
 * Sends one push message to every subscription a user has (they may have
 * several browsers/devices). A subscription the push service reports as
 * gone (410) or unknown (404) is deleted so we stop retrying it.
 */
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushSendResult[]> {
  const subscriptions = await prisma.pushSubscription.findMany({ where: { userId } });

  return Promise.all(
    subscriptions.map(async (sub): Promise<PushSendResult> => {
      try {
        const res = await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
        return { subscriptionId: sub.id, ok: true, statusCode: res.statusCode };
      } catch (error) {
        const statusCode = (error as { statusCode?: number } | undefined)?.statusCode;
        const body = (error as { body?: string } | undefined)?.body;
        if (statusCode === 404 || statusCode === 410) {
          await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
          return { subscriptionId: sub.id, ok: false, statusCode, removed: true };
        }
        console.error(`Push send failed for subscription ${sub.id}:`, error);
        return {
          subscriptionId: sub.id,
          ok: false,
          statusCode,
          error: body || (error instanceof Error ? error.message : "Unknown error"),
        };
      }
    })
  );
}
