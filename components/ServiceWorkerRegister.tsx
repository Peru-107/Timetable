"use client";

import { useEffect } from "react";
import { useSession } from "next-auth/react";

/**
 * Registers the PWA service worker, and once signed in, re-sends this
 * device's push subscription to the server. The browser can hold a live
 * subscription the server no longer has (it was pruned after a 404/410,
 * another account on the same device took it over, or the original save
 * failed) - and the scheduler only reads the server copy, so without this
 * the app would show reminders as on while none were ever scheduled.
 */
export function ServiceWorkerRegister() {
  const { status } = useSession();

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    let cancelled = false;
    (async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        if (!subscription || cancelled) return;
        const json = subscription.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
        });
      } catch {
        // Best-effort: the Profile page surfaces any real problem.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status]);

  return null;
}
