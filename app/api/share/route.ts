import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";

/** Create (or reuse) the share link for one of the caller's semesters. */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { semesterId } = await req.json();
    const semester = await prisma.semester.findFirst({
      where: { id: semesterId, userId: session.user.id },
      select: { id: true },
    });
    if (!semester) {
      return NextResponse.json({ error: "Semester not found" }, { status: 404 });
    }
    const existing = await prisma.shareLink.findFirst({
      where: { semesterId, userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });
    const link =
      existing ??
      (await prisma.shareLink.create({
        data: { token: randomBytes(12).toString("base64url"), userId: session.user.id, semesterId },
      }));
    return NextResponse.json({ token: link.token });
  } catch (error) {
    console.error("Error creating share link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

/** Revoke every share link for a semester, so old links stop working. */
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const semesterId = req.nextUrl.searchParams.get("semesterId");
    if (!semesterId) {
      return NextResponse.json({ error: "Semester ID required" }, { status: 400 });
    }
    await prisma.shareLink.deleteMany({ where: { semesterId, userId: session.user.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error revoking share link:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
