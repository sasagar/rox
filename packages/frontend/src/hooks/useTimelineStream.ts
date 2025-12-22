"use client";

/**
 * Timeline Stream Hook for real-time timeline updates
 *
 * Provides WebSocket-based real-time updates for timelines.
 * Uses a singleton pattern for WebSocket connection per timeline type.
 *
 * IMPORTANT: Uses module-level state and refs to avoid re-render loops.
 * The connection state is tracked via useState with a subscription pattern
 * to prevent atom-based re-renders from affecting unrelated components.
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { tokenAtom, isAuthenticatedAtom } from "../lib/atoms/auth";
import { timelineNotesAtom } from "../lib/atoms/timeline";
import {
  prependColumnNotesAtomFamily,
  removeColumnNoteAtomFamily,
  updateColumnNoteAtomFamily,
} from "../lib/atoms/column";
import type { Note } from "../lib/types/note";

/**
 * Timeline type
 */
export type TimelineType = "home" | "local" | "social" | "global";

// --- Module-level connection state management ---
// This avoids Jotai atom re-renders that were causing performance issues

interface TimelineWSConnection {
  socket: WebSocket | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  connectionCount: number;
  pingInterval: ReturnType<typeof setInterval> | null;
  connected: boolean;
  // Store refs to callbacks to avoid stale closures
  callbacks: {
    onNote: ((note: Note) => void) | null;
    onNoteDeleted: ((noteId: string) => void) | null;
    onNoteReacted: ((event: NoteReactedEvent) => void) | null;
  };
}

const timelineConnections: Record<TimelineType, TimelineWSConnection> = {
  home: { socket: null, reconnectTimeout: null, connectionCount: 0, pingInterval: null, connected: false, callbacks: { onNote: null, onNoteDeleted: null, onNoteReacted: null } },
  local: { socket: null, reconnectTimeout: null, connectionCount: 0, pingInterval: null, connected: false, callbacks: { onNote: null, onNoteDeleted: null, onNoteReacted: null } },
  social: { socket: null, reconnectTimeout: null, connectionCount: 0, pingInterval: null, connected: false, callbacks: { onNote: null, onNoteDeleted: null, onNoteReacted: null } },
  global: { socket: null, reconnectTimeout: null, connectionCount: 0, pingInterval: null, connected: false, callbacks: { onNote: null, onNoteDeleted: null, onNoteReacted: null } },
};

// Subscribers for connection state changes (for React state sync)
type ConnectionStateListener = (connected: boolean) => void;
const connectionListeners: Record<TimelineType, Set<ConnectionStateListener>> = {
  home: new Set(),
  local: new Set(),
  social: new Set(),
  global: new Set(),
};

function notifyConnectionChange(timelineType: TimelineType, connected: boolean) {
  timelineConnections[timelineType].connected = connected;
  for (const listener of connectionListeners[timelineType]) {
    listener(connected);
  }
}

/**
 * Get WebSocket endpoint URL for timeline type
 */
function getTimelineWSUrl(timelineType: TimelineType, token: string | null): string {
  const protocol = typeof window !== "undefined" && window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "";

  switch (timelineType) {
    case "home":
      return `${protocol}//${host}/ws/timeline?token=${encodeURIComponent(token || "")}`;
    case "local":
      return `${protocol}//${host}/ws/local-timeline`;
    case "social":
      return token
        ? `${protocol}//${host}/ws/social-timeline?token=${encodeURIComponent(token)}`
        : `${protocol}//${host}/ws/social-timeline`;
    case "global":
      return `${protocol}//${host}/ws/global-timeline`;
    default:
      return `${protocol}//${host}/ws/local-timeline`;
  }
}

/**
 * Reaction event data from WebSocket
 */
export interface NoteReactedEvent {
  noteId: string;
  reaction: string;
  action: "add" | "remove";
  counts: Record<string, number>;
  emojis: Record<string, string>;
}

/**
 * Connect to timeline WebSocket stream (singleton per timeline type)
 */
function connectTimelineWS(
  timelineType: TimelineType,
  token: string | null,
) {
  const connection = timelineConnections[timelineType];

  // Already connected or connecting
  if (connection.socket && (connection.socket.readyState === WebSocket.OPEN || connection.socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  // Clear any pending reconnect
  if (connection.reconnectTimeout) {
    clearTimeout(connection.reconnectTimeout);
    connection.reconnectTimeout = null;
  }

  const url = getTimelineWSUrl(timelineType, token);
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
      const { callbacks } = connection;

      switch (message.event) {
        case "connected":
          notifyConnectionChange(timelineType, true);
          break;
        case "note":
          callbacks.onNote?.(message.data as Note);
          break;
        case "noteDeleted":
          callbacks.onNoteDeleted?.(message.data.noteId);
          break;
        case "noteReacted":
          callbacks.onNoteReacted?.(message.data as NoteReactedEvent);
          break;
        case "heartbeat":
        case "pong":
          // Connection is alive
          break;
        case "error":
          console.error("Timeline WebSocket error:", message.data);
          break;
      }
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error);
    }
  };

  socket.onclose = (event) => {
    notifyConnectionChange(timelineType, false);
    connection.socket = null;

    if (connection.pingInterval) {
      clearInterval(connection.pingInterval);
      connection.pingInterval = null;
    }

    // Reconnect after delay (only if there are still subscribers and not auth error)
    if (connection.connectionCount > 0 && event.code !== 4001) {
      connection.reconnectTimeout = setTimeout(() => {
        connectTimelineWS(timelineType, token);
      }, 5000);
    }
  };

  socket.onerror = (error) => {
    console.warn(`Timeline WebSocket error (${timelineType}):`, error);
  };
}

/**
 * Disconnect timeline WebSocket stream (singleton)
 */
function disconnectTimelineWS(timelineType: TimelineType, force = false) {
  const connection = timelineConnections[timelineType];

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
      notifyConnectionChange(timelineType, false);
    }
  }
}

/**
 * Options for useTimelineStream hook
 */
export interface UseTimelineStreamOptions {
  /** Whether to enable the stream (default: true) */
  enabled?: boolean;
  /** Callback when a new note is received */
  onNewNote?: (note: Note) => void;
  /**
   * Column ID for deck view.
   * When provided, updates are written to column-scoped atoms instead of global timeline atom.
   */
  columnId?: string;
}

/**
 * Hook to subscribe to real-time timeline updates
 *
 * @param timelineType - Type of timeline to subscribe to
 * @param options - Stream options
 *
 * @example
 * ```tsx
 * // In a timeline component
 * const { connected } = useTimelineStream("home");
 *
 * // For local timeline (no auth required)
 * const { connected } = useTimelineStream("local");
 *
 * // With new note callback
 * const { connected } = useTimelineStream("home", {
 *   onNewNote: (note) => playSound(),
 * });
 * ```
 */
export function useTimelineStream(
  timelineType: TimelineType,
  options: UseTimelineStreamOptions | boolean = true,
) {
  // Support legacy boolean argument for backwards compatibility
  const { enabled = true, onNewNote, columnId } = typeof options === "boolean" ? { enabled: options } : options;

  // Global atom setter (for regular timeline view)
  const setGlobalNotes = useSetAtom(timelineNotesAtom);

  // Column-scoped atom setters (for deck view)
  const prependColumnNotes = useSetAtom(
    prependColumnNotesAtomFamily(columnId ?? "")
  );
  const removeColumnNote = useSetAtom(
    removeColumnNoteAtomFamily(columnId ?? "")
  );
  const updateColumnNote = useSetAtom(
    updateColumnNoteAtomFamily(columnId ?? "")
  );

  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const token = useAtomValue(tokenAtom);

  // Local state for connection status (synced via subscription)
  const [connected, setConnected] = useState(() => timelineConnections[timelineType].connected);

  // Track if this is the active timeline type
  const isActiveRef = useRef(false);

  // Refs to store stable references to latest values
  const tokenRef = useRef(token);
  const columnIdRef = useRef(columnId);
  const setGlobalNotesRef = useRef(setGlobalNotes);
  const prependColumnNotesRef = useRef(prependColumnNotes);
  const removeColumnNoteRef = useRef(removeColumnNote);
  const updateColumnNoteRef = useRef(updateColumnNote);
  const onNewNoteRef = useRef(onNewNote);
  const isInitializedRef = useRef(false);

  // Keep refs up to date
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    columnIdRef.current = columnId;
  }, [columnId]);

  useEffect(() => {
    setGlobalNotesRef.current = setGlobalNotes;
  }, [setGlobalNotes]);

  useEffect(() => {
    prependColumnNotesRef.current = prependColumnNotes;
    removeColumnNoteRef.current = removeColumnNote;
    updateColumnNoteRef.current = updateColumnNote;
  }, [prependColumnNotes, removeColumnNote, updateColumnNote]);

  useEffect(() => {
    onNewNoteRef.current = onNewNote;
  }, [onNewNote]);

  // Subscribe to connection state changes
  useEffect(() => {
    const listener: ConnectionStateListener = (isConnected) => {
      setConnected(isConnected);
    };

    connectionListeners[timelineType].add(listener);
    // Sync initial state
    setConnected(timelineConnections[timelineType].connected);

    return () => {
      connectionListeners[timelineType].delete(listener);
    };
  }, [timelineType]);

  // Update callbacks in the connection object
  // These are called from WebSocket message handler and need latest refs
  useEffect(() => {
    const connection = timelineConnections[timelineType];

    connection.callbacks.onNote = (note: Note) => {
      if (!isActiveRef.current) return;

      // Call onNewNote callback for sound notification etc.
      onNewNoteRef.current?.(note);

      // Update appropriate atom based on whether we're in deck mode
      if (columnIdRef.current) {
        // Deck view: update column-scoped atom
        prependColumnNotesRef.current([note]);
      } else {
        // Regular view: update global atom
        setGlobalNotesRef.current((prev) => {
          if (prev.some((n) => n.id === note.id)) {
            return prev;
          }
          return [note, ...prev];
        });
      }
    };

    connection.callbacks.onNoteDeleted = (noteId: string) => {
      if (!isActiveRef.current) return;

      if (columnIdRef.current) {
        // Deck view: update column-scoped atom
        removeColumnNoteRef.current(noteId);
      } else {
        // Regular view: update global atom
        setGlobalNotesRef.current((prev) => prev.filter((n) => n.id !== noteId));
      }
    };

    connection.callbacks.onNoteReacted = (event: NoteReactedEvent) => {
      if (!isActiveRef.current) return;

      if (columnIdRef.current) {
        // Deck view: update column-scoped atom
        updateColumnNoteRef.current({
          noteId: event.noteId,
          updates: {
            reactions: event.counts,
            reactionEmojis: event.emojis,
          },
        });
      } else {
        // Regular view: update global atom
        setGlobalNotesRef.current((prev) =>
          prev.map((note) => {
            if (note.id === event.noteId) {
              return {
                ...note,
                reactions: event.counts,
                reactionEmojis: event.emojis,
              };
            }
            return note;
          }),
        );
      }
    };

    return () => {
      // Don't clear callbacks on unmount - other subscribers might need them
    };
  }, [timelineType]);

  // Manage WebSocket connection lifecycle
  useEffect(() => {
    if (!enabled) return;

    // Home timeline requires authentication
    if (timelineType === "home" && !isAuthenticated) return;

    isActiveRef.current = true;
    const connection = timelineConnections[timelineType];
    connection.connectionCount++;

    // Connect on first subscriber
    if (connection.connectionCount === 1 && !isInitializedRef.current) {
      isInitializedRef.current = true;
      // Use Promise.resolve to avoid blocking the render
      Promise.resolve().then(() => {
        connectTimelineWS(timelineType, tokenRef.current);
      });
    }

    return () => {
      isActiveRef.current = false;
      connection.connectionCount--;

      // Disconnect when last subscriber unmounts
      if (connection.connectionCount <= 0) {
        connection.connectionCount = 0;
        isInitializedRef.current = false;
        disconnectTimelineWS(timelineType, true);
      }
    };
  }, [enabled, timelineType, isAuthenticated]);

  // Handle auth state changes (logout)
  useEffect(() => {
    if (timelineType === "home" && !isAuthenticated) {
      const connection = timelineConnections[timelineType];
      connection.connectionCount = 0;
      isInitializedRef.current = false;
      disconnectTimelineWS(timelineType, true);
    }
  }, [timelineType, isAuthenticated]);

  /**
   * Manual connect function
   */
  const connect = useCallback(() => {
    if (timelineType === "home" && !isAuthenticated) return;
    connectTimelineWS(timelineType, tokenRef.current);
  }, [timelineType, isAuthenticated]);

  /**
   * Manual disconnect function
   */
  const disconnect = useCallback(() => {
    disconnectTimelineWS(timelineType);
  }, [timelineType]);

  return {
    connected,
    connect,
    disconnect,
  };
}

/**
 * Hook to get timeline stream connection status
 */
export function useTimelineStreamStatus(timelineType: TimelineType) {
  const [connected, setConnected] = useState(() => timelineConnections[timelineType].connected);

  useEffect(() => {
    const listener: ConnectionStateListener = (isConnected) => {
      setConnected(isConnected);
    };

    connectionListeners[timelineType].add(listener);
    setConnected(timelineConnections[timelineType].connected);

    return () => {
      connectionListeners[timelineType].delete(listener);
    };
  }, [timelineType]);

  return connected;
}
