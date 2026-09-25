"use client";

/**
 * Attendance writes that survive a dead connection (bad campus Wi-Fi, a
 * lift, the metro). When a request can't reach the server, the mark is
 * kept in this device's storage and replayed once it's back online, and
 * the caller gets an optimistic record so the UI still updates.
 */
export type MarkStatus = "PRESENT" | "ABSENT" | "CANCELLED";

export interface MarkPayload {
  courseId: string;
  timetableEntryId: string;
  date: string;
  status: MarkStatus;
  hoursDuration: number;
}

export interface SyncedRecord {
  id: string;
  courseId: string;
  timetableEntryId: string | null;
  date: string;
  status: MarkStatus;
}

type QueueItem = { kind: "mark"; key: string; payload: MarkPayload } | { kind: "delete"; id: string };

const QUEUE_KEY = "timetable-offline-marks";
export const SYNC_EVENT = "attendance-queue-changed";
const OFFLINE_PREFIX = "offline-";

function readQueue(): QueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeQueue(queue: QueueItem[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage blocked: the mark just won't survive a reload.
  }
  window.dispatchEvent(new Event(SYNC_EVENT));
}

export function pendingCount(): number {
  return readQueue().length;
}

const markKey = (p: MarkPayload) => `${p.timetableEntryId}|${p.date}`;

function enqueueMark(payload: MarkPayload): SyncedRecord {
  const key = markKey(payload);
  // A newer mark for the same class and day replaces an older queued one.
  const queue = readQueue().filter((q) => !(q.kind === "mark" && q.key === key));
  queue.push({ kind: "mark", key, payload });
  writeQueue(queue);
  return {
    id: OFFLINE_PREFIX + key,
    courseId: payload.courseId,
    timetableEntryId: payload.timetableEntryId,
    date: payload.date,
    status: payload.status,
  };
}

/** Save a mark; offline it's queued and an optimistic record comes back. */
export async function saveMark(
  payload: MarkPayload
): Promise<{ record: SyncedRecord; queued: boolean } | { error: string }> {
  try {
    const res = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) return { record: await res.json(), queued: false };
    const data = await res.json().catch(() => null);
    return { error: data?.error || "Couldn't save attendance" };
  } catch {
    return { record: enqueueMark(payload), queued: true };
  }
}

/** Remove a mark; offline the delete is queued (or a queued mark dropped). */
export async function deleteMark(id: string): Promise<boolean> {
  if (id.startsWith(OFFLINE_PREFIX)) {
    const key = id.slice(OFFLINE_PREFIX.length);
    writeQueue(readQueue().filter((q) => !(q.kind === "mark" && q.key === key)));
    return true;
  }
  try {
    const res = await fetch(`/api/attendance?id=${id}`, { method: "DELETE" });
    return res.ok;
  } catch {
    writeQueue([...readQueue(), { kind: "delete", id }]);
    return true;
  }
}

let flushing = false;

/** Replay queued writes in order; returns how many reached the server. */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    for (const item of readQueue()) {
      let done = false;
      try {
        const res =
          item.kind === "mark"
            ? await fetch("/api/attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(item.payload),
              })
            : await fetch(`/api/attendance?id=${item.id}`, { method: "DELETE" });
        // A 4xx (e.g. the class was deleted meanwhile) will never succeed -
        // drop it rather than retrying forever.
        done = res.ok || (res.status >= 400 && res.status < 500);
        if (res.ok) sent++;
      } catch {
        break; // still offline - keep the rest for next time
      }
      if (done) {
        writeQueue(
          readQueue().filter((q) =>
            item.kind === "mark"
              ? !(q.kind === "mark" && q.key === item.key)
              : !(q.kind === "delete" && q.id === item.id)
          )
        );
      }
    }
  } finally {
    flushing = false;
  }
  return sent;
}
