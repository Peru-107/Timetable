"use client";

import { useEffect } from "react";

/** Registers the PWA service worker so the app is installable on Android/desktop Chrome. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return null;
}
