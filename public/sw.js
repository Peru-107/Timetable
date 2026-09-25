const CACHE_NAME = "timetable-shell-v2";
const SHELL_ASSETS = ["/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first: this app is data-driven (auth, live attendance/timetable
// data), so we never want a stale cached page or API response served over
// a fresh one. The cache only exists to let the app shell resolve when the
// device is briefly offline.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok && SHELL_ASSETS.some((asset) => event.request.url.endsWith(asset))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

// iOS Safari revokes a push subscription after a few pushes that don't show
// a notification, so every branch here must display one - never return early
// silently, even on a payload this version doesn't recognise.
self.addEventListener("push", (event) => {
  let payload = null;
  try {
    payload = event.data ? event.data.json() : null;
  } catch {
    payload = null;
  }

  if (!payload || payload.type !== "attendance-prompt") {
    event.waitUntil(
      self.registration.showNotification((payload && payload.title) || "Timetable Tracker", {
        body: (payload && payload.body) || "Open the app to see what's new.",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag:
          payload && payload.type === "test"
            ? "reminder-test"
            : (payload && payload.tag) || undefined,
        data: payload && payload.url ? { url: payload.url } : undefined,
      })
    );
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: `attendance-${payload.timetableEntryId}-${payload.date}`,
      requireInteraction: true,
      actions: [
        { action: "present", title: "Present" },
        { action: "absent", title: "Absent" },
      ],
      data: payload,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  const payload = event.notification.data;
  event.notification.close();

  if (event.action !== "present" && event.action !== "absent") {
    // Tapped the notification body itself - just bring the app forward.
    event.waitUntil(
      self.clients.matchAll({ type: "window" }).then((clients) => {
        const existing = clients.find((c) => "focus" in c);
        const url = (payload && payload.url) || "/dashboard";
        if (existing) {
          return existing.focus().then((c) => (payload && payload.url && c.navigate ? c.navigate(url) : c));
        }
        return self.clients.openWindow(url);
      })
    );
    return;
  }

  const status = event.action === "present" ? "PRESENT" : "ABSENT";

  event.waitUntil(
    fetch("/api/attendance", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        courseId: payload.courseId,
        timetableEntryId: payload.timetableEntryId,
        date: payload.date,
        status,
        hoursDuration: payload.hoursDuration,
      }),
    })
      .then((res) =>
        self.registration.showNotification(payload.title, {
          body: res.ok
            ? `Marked ${status === "PRESENT" ? "present" : "absent"}.`
            : "Couldn't save that - open the app to mark it manually.",
          icon: "/icon-192.png",
          tag: `attendance-${payload.timetableEntryId}-${payload.date}`,
        })
      )
      .catch(() =>
        self.registration.showNotification(payload.title, {
          body: "Couldn't save that - open the app to mark it manually.",
          icon: "/icon-192.png",
          tag: `attendance-${payload.timetableEntryId}-${payload.date}`,
        })
      )
  );
});
