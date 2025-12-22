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

// Additional callbacks for mention stream (separate from notification column callbacks)
const mentionCallbacks = new Map<string, (notification: Notification) => void>();

// Token getter for reconnection (set by hook, avoids dynamic import issues)
let tokenGetterForReconnect: (() => string | null) | null = null;

/**
 * Set the token getter function for WebSocket reconnection
 * This avoids dynamic import issues with custom Jotai stores
 *
 * @param getter - Function that returns the current auth token
 */
export function setTokenGetterForReconnect(
  getter: (() => string | null) | null
): void {
  tokenGetterForReconnect = getter;
}

/**
 * Register a callback to receive mention/reply notifications
 * Used by useMentionStream hook
 *
 * @param columnId - Column ID to register callback for
 * @param callback - Callback function to receive notifications
 */
export function registerMentionCallback(
  columnId: string,
  callback: (notification: Notification) => void
): void {
  mentionCallbacks.set(columnId, callback);
}

/**
 * Unregister a mention callback
 *
 * @param columnId - Column ID to unregister callback for
 */
export function unregisterMentionCallback(columnId: string): void {
  mentionCallbacks.delete(columnId);
}

// WebSocket connection constants
const PING_INTERVAL_MS = 25000; // 25 seconds
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const MAX_RECONNECT_DELAY_MS = 60000; // 60 seconds
const SOUND_DEBOUNCE_MS = 500; // Minimum 500ms between sounds

// WebSocket close codes - custom codes for specific error conditions
const WS_CLOSE_AUTH_REQUIRED = 4001;
const WS_CLOSE_ACCESS_DENIED = 4003;
const WS_CLOSE_NOT_FOUND = 4004;

// Reconnection state for exponential backoff
let reconnectAttempts = 0;

// Sound debounce to prevent rapid consecutive plays
let lastSoundPlayedAt = 0;

// Valid notification sound types
const NOTIFICATION_SOUND_TYPES: readonly NotificationSoundType[] = [
  "follow",
  "mention",
  "reply",
  "reaction",
  "renote",
  "quote",
] as const;

/**
 * Type guard to check if a notification type supports sound
 *
 * @param type - Notification type string to check
 * @returns True if the type is a valid notification sound type
 */
function isNotificationSoundType(type: string): type is NotificationSoundType {
  return NOTIFICATION_SOUND_TYPES.includes(type as NotificationSoundType);
}

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
 *
 * Note: Token is passed via query parameter, which is a common pattern for WebSocket auth.
 * While this may be logged in server access logs, the connection uses WSS (encrypted)
 * in production, making this approach acceptable. An alternative would be to send
 * the token in the first message after connection, but the current approach is simpler
 * and widely adopted.
 *
 * @param token - Authentication token
 * @returns WebSocket URL with token
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
 *
 * @param token - Authentication token
 */
function connectNotificationWS(token: string): void {
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
    // Reset reconnect attempts on successful connection
    reconnectAttempts = 0;

    // Start ping interval to keep connection alive
    connection.pingInterval = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "ping" }));
      }
    }, PING_INTERVAL_MS);
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
          // Validate required notification fields
          if (
            !notification ||
            typeof notification.id !== "string" ||
            typeof notification.type !== "string" ||
            typeof notification.createdAt !== "string"
          ) {
            console.warn("Received malformed notification:", message.data);
            break;
          }
          // Notify all notification column subscribers
          for (const callback of connection.columnCallbacks.values()) {
            try {
              callback(notification);
            } catch (error) {
              console.error("Error in notification callback:", error);
            }
          }
          // Also notify mention stream subscribers (for MentionsColumn)
          for (const callback of mentionCallbacks.values()) {
            try {
              callback(notification);
            } catch (error) {
              console.error("Error in mention callback:", error);
            }
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

    // Reconnect with exponential backoff (only if there are still subscribers and not auth error)
    const isAuthError =
      event.code === WS_CLOSE_AUTH_REQUIRED ||
      event.code === WS_CLOSE_ACCESS_DENIED ||
      event.code === WS_CLOSE_NOT_FOUND;

    if (connection.connectionCount > 0 && !isAuthError) {
      const delay = Math.min(
        INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttempts),
        MAX_RECONNECT_DELAY_MS
      );
      reconnectAttempts++;

      connection.reconnectTimeout = setTimeout(() => {
        // Re-fetch token using the registered getter
        const currentToken = tokenGetterForReconnect?.();
        if (currentToken) {
          connectNotificationWS(currentToken);
        }
      }, delay);
    }
  };

  socket.onerror = (error) => {
    console.warn("Notifications WebSocket error:", error);
  };
}

/**
 * Disconnect notification WebSocket stream (singleton)
 *
 * @param force - Force disconnect even if there are active subscribers
 */
function disconnectNotificationWS(force = false): void {
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
 * @returns Object containing connection state and control functions
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
export function useNotificationStream(options: UseNotificationStreamOptions): {
  /** Whether WebSocket is currently connected */
  connected: boolean;
  /** Manually connect to WebSocket */
  connect: () => void;
  /** Manually disconnect from WebSocket */
  disconnect: () => void;
} {
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
    prependNotificationsRef.current = prependColumnNotifications;
    onNewNotificationRef.current = onNewNotification;
    uiSettingsRef.current = uiSettings;
  }, [token, prependColumnNotifications, onNewNotification, uiSettings]);

  // Note: Token getter registration moved to connection lifecycle effect
  // to avoid race conditions with multiple hook instances

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

      // Play notification sound with debounce to prevent rapid consecutive plays
      const now = Date.now();
      if (now - lastSoundPlayedAt >= SOUND_DEBOUNCE_MS) {
        const settings = uiSettingsRef.current;
        const defaultSound = settings.notificationSound ?? "default";
        const defaultVolume = settings.notificationVolume ?? 50;

        if (defaultSound !== "none" || settings.notificationSoundsByType) {
          if (isNotificationSoundType(notification.type)) {
            playNotificationSoundForType(
              notification.type,
              settings.notificationSoundsByType,
              defaultSound,
              defaultVolume
            );
            lastSoundPlayedAt = now;
          }
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

    // Register token getter when first subscriber connects
    // This avoids race conditions when multiple hook instances mount/unmount
    if (connection.connectionCount === 1) {
      setTokenGetterForReconnect(() => tokenRef.current);
    }

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
        setTokenGetterForReconnect(null);
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
      mentionCallbacks.clear();
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
