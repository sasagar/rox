"use client";

/**
 * Notification Stream Hook for real-time notification updates in deck view
 *
 * This hook provides WebSocket-based real-time updates for notifications
 * specifically designed for deck columns. It updates column-scoped atoms
 * instead of global notification state.
 *
 * Uses a singleton pattern for WebSocket connection to prevent multiple
 * connections when multiple notification columns are used.
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { tokenAtom, isAuthenticatedAtom } from "../lib/atoms/auth";
import { uiSettingsAtom } from "../lib/atoms/uiSettings";
import { prependColumnNotificationsAtomFamily } from "../lib/atoms/column";
import { playNotificationSoundForType } from "../lib/utils/notificationSound";
import type { Notification } from "../lib/types/notification";
import type { NotificationSoundType } from "../lib/types/uiSettings";

// --- Module-level connection state management ---

interface NotificationWSConnection {
  socket: WebSocket | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  pingInterval: ReturnType<typeof setInterval> | null;
  connectionCount: number;
  connected: boolean;
  // Store callbacks for each column subscriber
  columnCallbacks: Map<string, (notification: Notification) => void>;
}

const notificationConnection: NotificationWSConnection = {
  socket: null,
  reconnectTimeout: null,
  pingInterval: null,
  connectionCount: 0,
  connected: false,
  columnCallbacks: new Map(),
};

// Subscribers for connection state changes
type ConnectionStateListener = (connected: boolean) => void;
const connectionListeners = new Set<ConnectionStateListener>();

function notifyConnectionChange(connected: boolean) {
  notificationConnection.connected = connected;
  for (const listener of connectionListeners) {
    listener(connected);
  }
}

/**
 * Get WebSocket endpoint URL for notifications
 */
function getNotificationsWSUrl(token: string): string {
  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss:"
      : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "";
  return `${protocol}//${host}/ws/notifications?token=${encodeURIComponent(token)}`;
}

/**
 * Connect to notification WebSocket stream (singleton)
 */
function connectNotificationWS(token: string) {
  const connection = notificationConnection;

  // Already connected or connecting
  if (
    connection.socket &&
    (connection.socket.readyState === WebSocket.OPEN ||
      connection.socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  // Clear any pending reconnect
  if (connection.reconnectTimeout) {
    clearTimeout(connection.reconnectTimeout);
    connection.reconnectTimeout = null;
  }

  const url = getNotificationsWSUrl(token);
  const socket = new WebSocket(url);
  connection.socket = socket;

  socket.onopen = () => {
    // Start ping interval to keep connection alive
    connection.pingInterval = setInterval(() => {
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
          notifyConnectionChange(true);
          break;
        case "notification": {
          const notification = message.data as Notification;
          // Notify all column subscribers
          for (const callback of connection.columnCallbacks.values()) {
            callback(notification);
          }
          break;
        }
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
    notifyConnectionChange(false);
    connection.socket = null;

    if (connection.pingInterval) {
      clearInterval(connection.pingInterval);
      connection.pingInterval = null;
    }

    // Reconnect after delay (only if there are still subscribers and not auth error)
    if (connection.connectionCount > 0 && event.code !== 4001) {
      connection.reconnectTimeout = setTimeout(() => {
        // Re-fetch token from store
        import("jotai").then(({ getDefaultStore }) => {
          const store = getDefaultStore();
          const currentToken = store.get(tokenAtom);
          if (currentToken) {
            connectNotificationWS(currentToken);
          }
        });
      }, 5000);
    }
  };

  socket.onerror = (error) => {
    console.warn("Notifications WebSocket error:", error);
  };
}

/**
 * Disconnect notification WebSocket stream (singleton)
 */
function disconnectNotificationWS(force = false) {
  const connection = notificationConnection;

  if (force || connection.connectionCount <= 0) {
    if (connection.reconnectTimeout) {
      clearTimeout(connection.reconnectTimeout);
      connection.reconnectTimeout = null;
    }

    if (connection.pingInterval) {
      clearInterval(connection.pingInterval);
      connection.pingInterval = null;
    }

    if (connection.socket) {
      connection.socket.close();
      connection.socket = null;
      notifyConnectionChange(false);
    }
  }
}

/**
 * Options for useNotificationStream hook
 */
export interface UseNotificationStreamOptions {
  /** Whether to enable the stream (default: true) */
  enabled?: boolean;
  /** Column ID for deck view - required */
  columnId: string;
  /** Callback when a new notification is received */
  onNewNotification?: (notification: Notification) => void;
}

/**
 * Hook to subscribe to real-time notification updates for deck columns
 *
 * @param options - Stream options including columnId
 *
 * @example
 * ```tsx
 * // In a notification column component
 * const { connected } = useNotificationStream({
 *   columnId: "col-123",
 *   onNewNotification: (notification) => playSound(),
 * });
 * ```
 */
export function useNotificationStream(options: UseNotificationStreamOptions) {
  const { enabled = true, columnId, onNewNotification } = options;

  // Column-scoped atom setter
  const prependColumnNotifications = useSetAtom(
    prependColumnNotificationsAtomFamily(columnId)
  );

  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const token = useAtomValue(tokenAtom);
  const uiSettings = useAtomValue(uiSettingsAtom);

  // Local state for connection status
  const [connected, setConnected] = useState(
    () => notificationConnection.connected
  );

  // Refs to store stable references
  const tokenRef = useRef(token);
  const prependNotificationsRef = useRef(prependColumnNotifications);
  const onNewNotificationRef = useRef(onNewNotification);
  const uiSettingsRef = useRef(uiSettings);
  const isInitializedRef = useRef(false);

  // Keep refs up to date
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    prependNotificationsRef.current = prependColumnNotifications;
  }, [prependColumnNotifications]);

  useEffect(() => {
    onNewNotificationRef.current = onNewNotification;
  }, [onNewNotification]);

  useEffect(() => {
    uiSettingsRef.current = uiSettings;
  }, [uiSettings]);

  // Subscribe to connection state changes
  useEffect(() => {
    const listener: ConnectionStateListener = (isConnected) => {
      setConnected(isConnected);
    };

    connectionListeners.add(listener);
    setConnected(notificationConnection.connected);

    return () => {
      connectionListeners.delete(listener);
    };
  }, []);

  // Register column callback
  useEffect(() => {
    if (!enabled || !columnId) return;

    const connection = notificationConnection;

    // Create callback for this column
    const callback = (notification: Notification) => {
      // Update column-scoped atom
      prependNotificationsRef.current([notification]);

      // Call user callback
      onNewNotificationRef.current?.(notification);

      // Play notification sound
      const settings = uiSettingsRef.current;
      const defaultSound = settings.notificationSound ?? "default";
      const defaultVolume = settings.notificationVolume ?? 50;

      if (defaultSound !== "none" || settings.notificationSoundsByType) {
        const soundType = notification.type as NotificationSoundType;
        if (
          ["follow", "mention", "reply", "reaction", "renote", "quote"].includes(
            notification.type
          )
        ) {
          playNotificationSoundForType(
            soundType,
            settings.notificationSoundsByType,
            defaultSound,
            defaultVolume
          );
        }
      }
    };

    connection.columnCallbacks.set(columnId, callback);

    return () => {
      connection.columnCallbacks.delete(columnId);
    };
  }, [enabled, columnId]);

  // Manage WebSocket connection lifecycle
  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    const connection = notificationConnection;
    connection.connectionCount++;

    // Connect on first subscriber
    if (connection.connectionCount === 1 && !isInitializedRef.current) {
      isInitializedRef.current = true;
      Promise.resolve().then(() => {
        if (tokenRef.current) {
          connectNotificationWS(tokenRef.current);
        }
      });
    }

    return () => {
      connection.connectionCount--;

      // Disconnect when last subscriber unmounts
      if (connection.connectionCount <= 0) {
        connection.connectionCount = 0;
        isInitializedRef.current = false;
        disconnectNotificationWS(true);
      }
    };
  }, [enabled, isAuthenticated]);

  // Handle auth state changes (logout)
  useEffect(() => {
    if (!isAuthenticated) {
      const connection = notificationConnection;
      connection.connectionCount = 0;
      connection.columnCallbacks.clear();
      isInitializedRef.current = false;
      disconnectNotificationWS(true);
    }
  }, [isAuthenticated]);

  /**
   * Manual connect function
   */
  const connect = useCallback(() => {
    if (!isAuthenticated || !tokenRef.current) return;
    connectNotificationWS(tokenRef.current);
  }, [isAuthenticated]);

  /**
   * Manual disconnect function
   */
  const disconnect = useCallback(() => {
    disconnectNotificationWS();
  }, []);

  return {
    connected,
    connect,
    disconnect,
  };
}
