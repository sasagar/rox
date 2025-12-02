"use client";

/**
 * Notification hooks for real-time notifications
 *
 * Provides hooks for managing notifications with SSE support.
 * Uses a singleton pattern for SSE connection to prevent multiple
 * connections when the hook is used in multiple components.
 */

import { useEffect, useCallback } from "react";
import { atom, useAtom, useAtomValue, useSetAtom, getDefaultStore } from "jotai";
import { tokenAtom, isAuthenticatedAtom } from "../lib/atoms/auth";
import { uiSettingsAtom } from "../lib/atoms/uiSettings";
import { notificationsApi } from "../lib/api/notifications";
import { playNotificationSound } from "../lib/utils/notificationSound";
import type { Notification, NotificationFetchOptions } from "../lib/types/notification";
import type { NotificationSound } from "../lib/types/uiSettings";

/**
 * Notifications list atom
 */
export const notificationsAtom = atom<Notification[]>([]);

/**
 * Unread count atom
 */
export const unreadCountAtom = atom<number>(0);

/**
 * Loading state atom
 */
export const notificationsLoadingAtom = atom<boolean>(false);

/**
 * SSE connection state atom
 */
export const sseConnectedAtom = atom<boolean>(false);

// --- Singleton SSE Connection Manager ---
// Module-level variables to ensure only one SSE connection exists

let sseEventSource: EventSource | null = null;
let sseReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let sseConnectionCount = 0; // Track how many components are using the connection

/**
 * Connect to SSE stream (singleton)
 * Only creates a new connection if one doesn't exist
 */
function connectSSESingleton(
  token: string,
  setNotifications: (fn: (prev: Notification[]) => Notification[]) => void,
  setUnreadCount: (fn: (prev: number) => number | number) => void,
  setSseConnected: (connected: boolean) => void,
  getUiSettings: () => { notificationSound?: NotificationSound; notificationVolume?: number },
) {
  // Already connected or connecting
  if (sseEventSource) return;

  // Clear any pending reconnect
  if (sseReconnectTimeout) {
    clearTimeout(sseReconnectTimeout);
    sseReconnectTimeout = null;
  }

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${baseUrl}/api/notifications/stream`;

  // EventSource doesn't support custom headers, so we use a workaround
  // Backend should accept token from query param for SSE
  const eventSource = new EventSource(`${url}?token=${encodeURIComponent(token)}`);
  sseEventSource = eventSource;

  eventSource.addEventListener("connected", () => {
    console.log("SSE connected for notifications (singleton)");
    setSseConnected(true);
  });

  eventSource.addEventListener("notification", (event) => {
    try {
      const notification = JSON.parse(event.data) as Notification;
      // Add new notification at the beginning
      setNotifications((prev) => [notification, ...prev]);

      // Play notification sound
      const uiSettings = getUiSettings();
      if (uiSettings.notificationSound && uiSettings.notificationSound !== "none") {
        playNotificationSound(uiSettings.notificationSound, uiSettings.notificationVolume ?? 50);
      }
    } catch (error) {
      console.error("Failed to parse notification event:", error);
    }
  });

  eventSource.addEventListener("unreadCount", (event) => {
    try {
      const { count } = JSON.parse(event.data);
      setUnreadCount(count);
    } catch (error) {
      console.error("Failed to parse unreadCount event:", error);
    }
  });

  eventSource.addEventListener("heartbeat", () => {
    // Heartbeat received, connection is alive
  });

  eventSource.onerror = () => {
    console.warn("SSE connection error, reconnecting...");
    setSseConnected(false);
    eventSource.close();
    sseEventSource = null;

    // Reconnect after delay (only if there are still subscribers)
    if (sseConnectionCount > 0) {
      sseReconnectTimeout = setTimeout(() => {
        const store = getDefaultStore();
        const currentToken = store.get(tokenAtom);
        if (currentToken) {
          connectSSESingleton(
            currentToken,
            setNotifications,
            setUnreadCount,
            setSseConnected,
            getUiSettings,
          );
        }
      }, 5000);
    }
  };
}

/**
 * Disconnect SSE stream (singleton)
 * Only actually disconnects when connection count reaches 0
 */
function disconnectSSESingleton(setSseConnected: (connected: boolean) => void, force = false) {
  if (force || sseConnectionCount <= 0) {
    if (sseReconnectTimeout) {
      clearTimeout(sseReconnectTimeout);
      sseReconnectTimeout = null;
    }

    if (sseEventSource) {
      sseEventSource.close();
      sseEventSource = null;
      setSseConnected(false);
    }
  }
}

/**
 * Hook to manage notification state and SSE connection
 *
 * This hook uses a singleton pattern for SSE connections.
 * Multiple components can call this hook, but only one SSE connection
 * will be maintained. The connection is closed when the last component
 * using it unmounts.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useAtom(notificationsAtom);
  const [unreadCount, setUnreadCount] = useAtom(unreadCountAtom);
  const [loading, setLoading] = useAtom(notificationsLoadingAtom);
  const [sseConnected, setSseConnected] = useAtom(sseConnectedAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const token = useAtomValue(tokenAtom);
  const uiSettings = useAtomValue(uiSettingsAtom);

  /**
   * Fetch notifications from API
   */
  const fetchNotifications = useCallback(
    async (options: NotificationFetchOptions = {}) => {
      if (!isAuthenticated) return;

      setLoading(true);
      try {
        const data = await notificationsApi.getNotifications(options);
        if (options.untilId) {
          // Pagination: append to existing
          setNotifications((prev) => [...prev, ...data]);
        } else {
          // Initial load or refresh: replace
          setNotifications(data);
        }
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      } finally {
        setLoading(false);
      }
    },
    [isAuthenticated, setNotifications, setLoading],
  );

  /**
   * Fetch unread count from API
   */
  const fetchUnreadCount = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const { count } = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, [isAuthenticated, setUnreadCount]);

  /**
   * Mark a notification as read
   */
  const markAsRead = useCallback(
    async (notificationId: string) => {
      try {
        await notificationsApi.markAsRead(notificationId);
        setNotifications((prev) =>
          prev.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)),
        );
        setUnreadCount((prev) => Math.max(0, prev - 1));
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }
    },
    [setNotifications, setUnreadCount],
  );

  /**
   * Mark all notifications as read
   */
  const markAllAsRead = useCallback(async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error("Failed to mark all notifications as read:", error);
    }
  }, [setNotifications, setUnreadCount]);

  /**
   * Delete a notification
   */
  const deleteNotification = useCallback(
    async (notificationId: string) => {
      try {
        await notificationsApi.deleteNotification(notificationId);
        setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
        // Update unread count if deleted notification was unread
        const deleted = notifications.find((n) => n.id === notificationId);
        if (deleted && !deleted.isRead) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
        }
      } catch (error) {
        console.error("Failed to delete notification:", error);
      }
    },
    [notifications, setNotifications, setUnreadCount],
  );

  /**
   * Load more notifications (pagination)
   */
  const loadMore = useCallback(async () => {
    if (notifications.length === 0 || loading) return;

    const lastNotification = notifications[notifications.length - 1];
    if (lastNotification) {
      await fetchNotifications({ untilId: lastNotification.id });
    }
  }, [notifications, loading, fetchNotifications]);

  /**
   * Connect to SSE stream for real-time updates
   */
  const connectSSE = useCallback(() => {
    if (!token) return;
    // Use the captured uiSettings in a getter function for the singleton
    const getUiSettings = () => uiSettings;
    connectSSESingleton(token, setNotifications, setUnreadCount, setSseConnected, getUiSettings);
  }, [token, setNotifications, setUnreadCount, setSseConnected, uiSettings]);

  /**
   * Disconnect SSE stream
   */
  const disconnectSSE = useCallback(() => {
    disconnectSSESingleton(setSseConnected);
  }, [setSseConnected]);

  // Effect to manage SSE connection based on auth state
  // Uses reference counting to ensure connection persists across multiple hook instances
  useEffect(() => {
    if (isAuthenticated && token) {
      sseConnectionCount++;

      // Only fetch and connect on first subscriber
      if (sseConnectionCount === 1) {
        fetchNotifications();
        fetchUnreadCount();
        connectSSE();
      }
    }

    return () => {
      if (isAuthenticated && token) {
        sseConnectionCount--;

        // Only disconnect when last subscriber unmounts
        if (sseConnectionCount <= 0) {
          sseConnectionCount = 0;
          disconnectSSESingleton(setSseConnected, true);
        }
      }
    };
  }, [isAuthenticated, token, fetchNotifications, fetchUnreadCount, connectSSE, setSseConnected]);

  // Handle auth state changes (logout)
  useEffect(() => {
    if (!isAuthenticated) {
      // Force disconnect and clear state on logout
      sseConnectionCount = 0;
      disconnectSSESingleton(setSseConnected, true);
      setNotifications([]);
      setUnreadCount(0);
    }
  }, [isAuthenticated, setSseConnected, setNotifications, setUnreadCount]);

  return {
    notifications,
    unreadCount,
    loading,
    sseConnected,
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    connectSSE,
    disconnectSSE,
  };
}

/**
 * Hook to get only the unread count (lightweight)
 */
export function useUnreadCount() {
  const unreadCount = useAtomValue(unreadCountAtom);
  const setUnreadCount = useSetAtom(unreadCountAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);

  const refresh = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const { count } = await notificationsApi.getUnreadCount();
      setUnreadCount(count);
    } catch (error) {
      console.error("Failed to fetch unread count:", error);
    }
  }, [isAuthenticated, setUnreadCount]);

  return { unreadCount, refresh };
}
