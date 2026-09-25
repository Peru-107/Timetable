import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { sendPushToUser } from "@/lib/webPush";
import { NextResponse } from "next/server";

/**
 * Sends a push right now to every device the user has reminders on for, and
 * reports what each push service said. Lets a student confirm reminders
 * actually reach their phone instead of waiting for a class to end - and
 * turns "nothing arrived" into a specific cause.
 */
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const results = await sendPushToUser(session.user.id, {
      type: "test",
      title: "Reminders are working",
      body: "You'll get a Present/Absent prompt like this when each class ends.",
    });

    return NextResponse.json({
      devices: results.length,
      delivered: results.filter((r) => r.ok).length,
      removed: results.filter((r) => r.removed).length,
      failures: results
        .filter((r) => !r.ok && !r.removed)
        .map((r) => ({ statusCode: r.statusCode, error: r.error })),
    });
  } catch (error) {
    console.error("Error sending test notification:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
