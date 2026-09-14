import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/webPush";
import { Receiver } from "@upstash/qstash";
import { NextRequest, NextResponse } from "next/server";

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY || "",
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY || "",
});

interface DeliverBody {
  userId: string;
  timetableEntryId: string;
  courseId: string;
  courseName: string;
  date: string;
  hoursDuration: number;
}

/** QStash webhook target - fires at the exact instant a class ends. */
export async function POST(req: NextRequest) {
  const rawBody = await req.text();

  if (process.env.QSTASH_CURRENT_SIGNING_KEY) {
    const signature = req.headers.get("upstash-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    const valid = await receiver.verify({ signature, body: rawBody }).catch(() => false);
    if (!valid) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  try {
    const payload: DeliverBody = JSON.parse(rawBody);
    const { userId, timetableEntryId, courseId, courseName, date, hoursDuration } = payload;

    const targetDate = new Date(date);
    const dayStart = new Date(targetDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setHours(23, 59, 59, 999);

    // Same day-bucket rule as POST /api/attendance: don't prompt for a class
    // the user already marked (through the app, or an earlier prompt).
    const existing = await prisma.attendanceRecord.findFirst({
      where: { userId, courseId, timetableEntryId, date: { gte: dayStart, lte: dayEnd } },
    });
    if (existing) {
      return NextResponse.json({ skipped: "already marked" });
    }

    await sendPushToUser(userId, {
      type: "attendance-prompt",
      title: courseName,
      body: "Your class just ended - were you there?",
      timetableEntryId,
      courseId,
      date,
      hoursDuration,
    });

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("Error delivering class-end notification:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
