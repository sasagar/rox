"use client";

/**
 * Notification hooks for real-time notifications
 *
 * Provides hooks for managing notifications with WebSocket support.
 * Uses a singleton pattern for WebSocket connection to prevent multiple
 * connections when the hook is used in multiple components.
 */

import { useEffect, useCallback, useRef } from "react";
import { atom, useAtom, useAtomValue, useSetAtom, getDefaultStore } from "jotai";
import { tokenAtom, isAuthenticatedAtom } from "../lib/atoms/auth";
import { uiSettingsAtom } from "../lib/atoms/uiSettings";
import { notificationsApi } from "../lib/api/notifications";
import { playNotificationSoundForType } from "../lib/utils/notificationSound";
import type { Notification, NotificationFetchOptions } from "../lib/types/notification";
import type { NotificationSound, NotificationSoundType, NotificationSoundsByType } from "../lib/types/uiSettings";

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
 * WebSocket connection state atom
 */
export const wsConnectedAtom = atom<boolean>(false);

// --- Singleton WebSocket Connection Manager ---
// Module-level variables to ensure only one WebSocket connection exists

let wsSocket: WebSocket | null = null;
let wsReconnectTimeout: ReturnType<typeof setTimeout> | null = null;
let wsPingInterval: ReturnType<typeof setInterval> | null = null;
let wsConnectionCount = 0; // Track how many components are using the connection

/**
 * Get WebSocket endpoint URL for notifications
 */
function getNotificationsWSUrl(token: string): string {
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "";
  return `${protocol}//${host}/ws/notifications?token=${encodeURIComponent(token)}`;
}

/**
 * Connect to WebSocket stream (singleton)
 * Only creates a new connection if one doesn't exist
 */
function connectWSSingleton(
  token: string,
  setNotifications: (fn: (prev: Notification[]) => Notification[]) => void,
  setUnreadCount: (fn: (prev: number) => number | number) => void,
  setWsConnected: (connected: boolean) => void,
  getUiSettings: () => {
    notificationSound?: NotificationSound;
    notificationVolume?: number;
    notificationSoundsByType?: NotificationSoundsByType;
  },
) {
  // Already connected or connecting
  if (wsSocket && wsSocket.readyState === WebSocket.OPEN) return;

  // Clear any pending reconnect
  if (wsReconnectTimeout) {
    clearTimeout(wsReconnectTimeout);
    wsReconnectTimeout = null;
  }

  const url = getNotificationsWSUrl(token);
  const socket = new WebSocket(url);
  wsSocket = socket;

  socket.onopen = () => {
    console.log("Notifications WebSocket connected (singleton)");
    // Start ping interval to keep connection alive
    wsPingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, 25000);
  };

  socket.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      switch (message.event) {
        case "connected":
          setWsConnected(true);
          break;
        case "notification": {
          const notification = message.data as Notification;
          // Add new notification at the beginning
          setNotifications((prev) => [notification, ...prev]);

          // Play notification sound based on notification type
          const uiSettings = getUiSettings();
          const defaultSound = uiSettings.notificationSound ?? "default";
          const defaultVolume = uiSettings.notificationVolume ?? 50;

          // Only play if default sound is not "none" or there's a per-type override
          if (defaultSound !== "none" || uiSettings.notificationSoundsByType) {
            // Map notification type to sound type (exclude warning and follow_request_accepted)
            const soundType = notification.type as NotificationSoundType;
            if (["follow", "mention", "reply", "reaction", "renote", "quote"].includes(notification.type)) {
              playNotificationSoundForType(
                soundType,
                uiSettings.notificationSoundsByType,
                defaultSound,
                defaultVolume,
              );
            }
          }
          break;
        }
        case "unreadCount":
          setUnreadCount(message.data.count);
          break;
        case "heartbeat":
        case "pong":
          // Connection is alive
          break;
        case "error":
          console.error("Notifications WebSocket error:", message.data);
          break;
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  };

  socket.onclose = (event) => {
    console.log(`Notifications WebSocket closed (code: ${event.code})`);
    setWsConnected(false);
    wsSocket = null;

    if (wsPingInterval) {
      clearInterval(wsPingInterval);
      wsPingInterval = null;
    }

    // Reconnect after delay (only if there are still subscribers and not auth error)
    if (wsConnectionCount > 0 && event.code !== 4001) {
      wsReconnectTimeout = setTimeout(() => {
        const store = getDefaultStore();
        const currentToken = store.get(tokenAtom);
        if (currentToken) {
          connectWSSingleton(
            currentToken,
            setNotifications,
            setUnreadCount,
            setWsConnected,
            getUiSettings,
          );
        }
      }, 5000);
    }
  };

  socket.onerror = (error) => {
    console.warn("Notifications WebSocket error:", error);
  };
}

/**
 * Disconnect WebSocket stream (singleton)
 * Only actually disconnects when connection count reaches 0
 */
function disconnectWSSingleton(setWsConnected: (connected: boolean) => void, force = false) {
  if (force || wsConnectionCount <= 0) {
    if (wsReconnectTimeout) {
      clearTimeout(wsReconnectTimeout);
      wsReconnectTimeout = null;
    }

    if (wsPingInterval) {
      clearInterval(wsPingInterval);
      wsPingInterval = null;
    }

    if (wsSocket) {
      wsSocket.close();
      wsSocket = null;
      setWsConnected(false);
    }
  }
}

/**
 * Hook to manage notification state and WebSocket connection
 *
 * This hook uses a singleton pattern for WebSocket connections.
 * Multiple components can call this hook, but only one WebSocket connection
 * will be maintained. The connection is closed when the last component
 * using it unmounts.
 */
export function useNotifications() {
  const [notifications, setNotifications] = useAtom(notificationsAtom);
  const [unreadCount, setUnreadCount] = useAtom(unreadCountAtom);
  const [loading, setLoading] = useAtom(notificationsLoadingAtom);
  const [wsConnected, setWsConnected] = useAtom(wsConnectedAtom);
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

  // Refs to store stable references to latest values
  const uiSettingsRef = useRef(uiSettings);
  const tokenRef = useRef(token);
  const isInitializedRef = useRef(false);

  // Keep refs up to date
  useEffect(() => {
    uiSettingsRef.current = uiSettings;
  }, [uiSettings]);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  /**
   * Connect to WebSocket stream for real-time updates
   */
  const connectWS = useCallback(() => {
    const currentToken = tokenRef.current;
    if (!currentToken) return;
    // Use ref to get latest uiSettings without causing re-renders
    const getUiSettings = () => uiSettingsRef.current;
    connectWSSingleton(currentToken, setNotifications, setUnreadCount, setWsConnected, getUiSettings);
  }, [setNotifications, setUnreadCount, setWsConnected]);

  /**
   * Disconnect WebSocket stream
   */
  const disconnectWS = useCallback(() => {
    disconnectWSSingleton(setWsConnected);
  }, [setWsConnected]);

  // Effect to manage WebSocket connection based on auth state
  // Uses reference counting to ensure connection persists across multiple hook instances
  useEffect(() => {
    if (isAuthenticated && token) {
      wsConnectionCount++;

      // Only connect on first subscriber
      if (wsConnectionCount === 1 && !isInitializedRef.current) {
        isInitializedRef.current = true;
        // Use Promise.resolve to avoid blocking and potential race conditions
        Promise.resolve().then(() => {
          fetchNotifications();
          fetchUnreadCount();
          connectWS();
        });
      }
    }

    return () => {
      if (isAuthenticated && token) {
        wsConnectionCount--;

        // Only disconnect when last subscriber unmounts
        if (wsConnectionCount <= 0) {
          wsConnectionCount = 0;
          isInitializedRef.current = false;
          disconnectWSSingleton(setWsConnected, true);
        }
      }
    };
    // Only depend on auth state changes, not on callback functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  // Handle auth state changes (logout)
  useEffect(() => {
    if (!isAuthenticated) {
      // Force disconnect and clear state on logout
      wsConnectionCount = 0;
      isInitializedRef.current = false;
      disconnectWSSingleton(setWsConnected, true);
      setNotifications([]);
      setUnreadCount(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return {
    notifications,
    unreadCount,
    loading,
    sseConnected: wsConnected, // Keep API compatible
    fetchNotifications,
    fetchUnreadCount,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    loadMore,
    connectSSE: connectWS, // Keep API compatible
    disconnectSSE: disconnectWS, // Keep API compatible
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
