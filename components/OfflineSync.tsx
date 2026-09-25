"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CloudOff } from "lucide-react";
import { flushQueue, pendingCount, SYNC_EVENT } from "@/lib/attendanceSync";
import { showToast } from "@/lib/toast";

/**
 * Replays attendance marks saved while offline as soon as the connection
 * (and a signed-in session) is back, and shows how many are waiting.
 */
export function OfflineSync() {
  const { status } = useSession();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const refresh = () => setPending(pendingCount());
    const flush = async () => {
      if (status !== "authenticated" || !navigator.onLine || pendingCount() === 0) return;
      const sent = await flushQueue();
      if (sent > 0) {
        showToast({ message: `Synced ${sent} attendance ${sent === 1 ? "mark" : "marks"} saved offline` });
        window.dispatchEvent(new Event("attendance-synced"));
      }
    };
    refresh();
    flush();
    window.addEventListener(SYNC_EVENT, refresh);
    window.addEventListener("online", flush);
    return () => {
      window.removeEventListener(SYNC_EVENT, refresh);
      window.removeEventListener("online", flush);
    };
  }, [status]);

  if (pending === 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[55] flex justify-center px-4">
      <div className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-foreground">
        <CloudOff className="h-3.5 w-3.5 text-warning" />
        {pending} {pending === 1 ? "mark" : "marks"} saved offline - will sync when you&apos;re back
        online
      </div>
    </div>
  );
}
