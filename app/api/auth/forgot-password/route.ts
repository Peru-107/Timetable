import { prisma } from "@/lib/prisma";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "@/lib/passwordReset";
import { sendPasswordResetEmail } from "@/lib/email";
import { NextRequest, NextResponse } from "next/server";

// Always the same response whether or not the email is registered - a
// different response would let an attacker enumerate real accounts by
// email.
const GENERIC_MESSAGE =
  "If an account exists for that email, we've sent a link to reset your password.";

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      // Only one active reset link at a time - an older, still-emailed link
      // shouldn't keep working after a newer one was requested.
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id } });

      const { rawToken, tokenHash } = generateResetToken();
      await prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });

      const baseUrl = process.env.NEXTAUTH_URL || req.nextUrl.origin;
      const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
      await sendPasswordResetEmail(user.email, resetUrl);
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    console.error("Error requesting password reset:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
