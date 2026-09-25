import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import { scheduleRemainingClassesToday } from "@/lib/notificationScheduler";

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { endpoint, keys } = await req.json();
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    const hadSubscription =
      (await prisma.pushSubscription.count({ where: { userId: session.user.id } })) > 0;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: { userId: session.user.id, p256dh: keys.p256dh, auth: keys.auth },
      create: { userId: session.user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    });

    // The daily cron only runs at 5 AM IST, so without this someone who turns
    // reminders on mid-morning gets nothing until tomorrow. Only on the first
    // subscription: the app re-syncs an existing one on every load, and that
    // mustn't re-publish (dedup IDs would absorb it, but it'd still cost a
    // QStash call per class per page view).
    if (!hadSubscription) {
      await scheduleRemainingClassesToday([session.user.id]).catch((error) =>
        console.error("Error scheduling today's reminders on subscribe:", error)
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error saving push subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const endpoint = req.nextUrl.searchParams.get("endpoint");
    if (!endpoint) {
      return NextResponse.json({ error: "Endpoint required" }, { status: 400 });
    }

    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: session.user.id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error removing push subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const count = await prisma.pushSubscription.count({ where: { userId: session.user.id } });
    return NextResponse.json({ subscribed: count > 0 });
  } catch (error) {
    console.error("Error checking push subscription:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
