import { Client } from "@upstash/qstash";

export const qstashClient = new Client({ token: process.env.QSTASH_TOKEN || "" });

/** Base URL QStash should call back into - the deployed app, never localhost. */
export function getAppUrl(): string {
  const url = process.env.APP_URL || process.env.NEXTAUTH_URL;
  if (!url) {
    throw new Error("APP_URL or NEXTAUTH_URL must be set for QStash callbacks");
  }
  return url.replace(/\/$/, "");
}
