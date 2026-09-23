import { Resend } from "resend";

/**
 * RESEND_API_KEY is a deploy-time config step (like GEMINI_API_KEY or the
 * VAPID keys) that isn't set in every environment. Missing config here must
 * never break the reset flow or leak whether it's configured - log the
 * would-be email instead of throwing, so forgot-password still responds the
 * same generic "check your email" message either way.
 *
 * The link is logged unconditionally, not just when RESEND_API_KEY is
 * missing: Resend's shared onboarding@resend.dev sender only delivers to
 * the account's own registered email until a custom domain is verified, so
 * for every other recipient this log line is the only way to actually get
 * the link during that window. Remove this once EMAIL_FROM is on a verified
 * domain - production reset links shouldn't sit in server logs once real
 * delivery works for everyone.
 */
export async function sendPasswordResetEmail(email: string, resetUrl: string) {
  console.log(`Password reset link for ${email}: ${resetUrl}`);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set - email not actually sent, see link above.");
    return;
  }

  const resend = new Resend(apiKey);
  const from = process.env.EMAIL_FROM || "Timetable Tracker <onboarding@resend.dev>";

  try {
    await resend.emails.send({
      from,
      to: email,
      subject: "Reset your Timetable Tracker password",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
          <h2>Reset your password</h2>
          <p>We got a request to reset the password for your Timetable Tracker account.</p>
          <p>
            <a href="${resetUrl}" style="display: inline-block; padding: 12px 20px; background: #c9843a; color: #fff; text-decoration: none; border-radius: 8px;">
              Reset Password
            </a>
          </p>
          <p>This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
  }
}
