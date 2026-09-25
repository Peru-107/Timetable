import { scheduleRemainingClassesToday } from "@/lib/notificationScheduler";
import { NextRequest, NextResponse } from "next/server";

/**
 * Runs once a day (Vercel Hobby cron only allows daily schedules) early in
 * the IST morning. It doesn't send anything itself - it enqueues one QStash
 * message per class ending today, each set to fire at the exact IST end
 * time, so the actual notification lands within a minute of the class
 * ending regardless of cron's daily granularity.
 */
export async function GET(req: NextRequest) {
  // Fail closed outside local dev: a missing CRON_SECRET must not leave the
  // scheduler open to anyone on the internet.
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret || process.env.NODE_ENV === "production") {
    const auth = req.headers.get("authorization");
    if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const result = await scheduleRemainingClassesToday();
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error scheduling today's class-end notifications:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
