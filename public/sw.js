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

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  if (payload.type !== "attendance-prompt") return;

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
        if (existing) return existing.focus();
        return self.clients.openWindow("/dashboard");
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
