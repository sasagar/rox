/**
 * Service Worker for PWA Support and Push Notifications
 *
 * Handles:
 * - Offline support with caching
 * - Background push notifications
 */

// Service Worker version - bump this to force cache refresh
const SW_VERSION = "2.3.0";

// Cache names
const CACHE_NAME = `rox-cache-v${SW_VERSION}`;
const STATIC_CACHE_NAME = `rox-static-v${SW_VERSION}`;

// Assets to cache on install (app shell)
const STATIC_ASSETS = [
  "/",
  "/timeline",
  "/notifications",
  "/login",
  "/favicon.png",
  "/api/instance/manifest.json",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing Service Worker version:", SW_VERSION);

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then((cache) => {
      console.log("[SW] Caching static assets");
      // Use addAll for static assets, but don't fail if some aren't available
      return Promise.allSettled(
        STATIC_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] Failed to cache ${url}:`, err);
          })
        )
      );
    })
  );

  // Skip waiting to activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Service Worker activated");

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Delete old version caches
          if (
            cacheName !== CACHE_NAME &&
            cacheName !== STATIC_CACHE_NAME &&
            (cacheName.startsWith("rox-cache-") || cacheName.startsWith("rox-static-"))
          ) {
            console.log("[SW] Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip non-http(s) requests (e.g., chrome-extension://)
  if (!url.protocol.startsWith("http")) {
    return;
  }

  // Skip API requests - always fetch from network
  if (url.pathname.startsWith("/api/")) {
    return;
  }

  // Skip WebSocket and SSE connections
  if (
    request.headers.get("upgrade") === "websocket" ||
    request.headers.get("accept")?.includes("text/event-stream")
  ) {
    return;
  }

  // Network-first strategy for HTML pages (for SPA navigation)
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Fallback to cache if offline
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback to cached home page for SPA navigation
            return caches.match("/timeline") || caches.match("/");
          });
        })
    );
    return;
  }

  // Cache-first strategy for static assets (JS, CSS, images)
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(STATIC_CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }
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
