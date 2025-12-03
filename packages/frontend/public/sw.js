/**
 * Service Worker for Push Notifications
 *
 * Handles background push notifications for Rox
 */

// Service Worker version
const SW_VERSION = "1.0.1";

// Install event
self.addEventListener("install", (_event) => {
  console.log("[SW] Installing Service Worker version:", SW_VERSION);
  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event
self.addEventListener("activate", (event) => {
  console.log("[SW] Service Worker activated");
  // Take control of all clients immediately
  event.waitUntil(self.clients.claim());
});

// Push event - handle incoming push notifications
self.addEventListener("push", (event) => {
  console.log("[SW] Push notification received, event.data:", event.data ? "present" : "null");

  let data = {
    title: "New Notification",
    body: "You have a new notification",
    icon: "/favicon.png",
    badge: "/favicon.png",
    tag: "default",
    data: {
      url: "/notifications",
    },
  };

  // Parse push data if available
  if (event.data) {
    try {
      const rawText = event.data.text();
      console.log("[SW] Raw push data:", rawText);
      const payload = JSON.parse(rawText);
      console.log("[SW] Parsed payload:", JSON.stringify(payload));
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: payload.data || data.data,
      };
    } catch (e) {
      console.error("[SW] Failed to parse push data:", e);
    }
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    vibrate: [100, 50, 100],
    silent: false, // Enable notification sound
    requireInteraction: false,
    actions: [
      {
        action: "open",
        title: "Open",
      },
      {
        action: "dismiss",
        title: "Dismiss",
      },
    ],
  };

  console.log("[SW] Showing notification with title:", data.title, "options:", JSON.stringify(options));

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => {
        console.log("[SW] showNotification succeeded");
      })
      .catch((error) => {
        console.error("[SW] showNotification failed:", error);
      })
  );
});

// Notification click event
self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification clicked:", event.action);

  event.notification.close();

  // Handle action buttons
  if (event.action === "dismiss") {
    return;
  }

  // Get URL from notification data
  const urlToOpen = event.notification.data?.url || "/notifications";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Check if app is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          // Navigate existing window
          client.postMessage({
            type: "NOTIFICATION_CLICK",
            url: urlToOpen,
          });
          return client.focus();
        }
      }

      // Open new window if app not open
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    }),
  );
});

// Notification close event
self.addEventListener("notificationclose", (_event) => {
  console.log("[SW] Notification closed");
});

// Message handler for communication with main app
self.addEventListener("message", (event) => {
  console.log("[SW] Message received:", event.data);

  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
