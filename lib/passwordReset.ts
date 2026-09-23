import { randomBytes, createHash } from "crypto";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/** The raw token goes in the emailed link; only its hash is ever stored. */
export function generateResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = randomBytes(32).toString("hex");
  return { rawToken, tokenHash: hashResetToken(rawToken) };
}

export function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}
