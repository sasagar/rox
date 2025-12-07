"use client";

/**
 * Timeline Stream Hook for real-time timeline updates
 *
 * Provides WebSocket-based real-time updates for timelines.
 * Uses a singleton pattern for WebSocket connection per timeline type.
 */

import { useEffect, useCallback, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { tokenAtom, isAuthenticatedAtom } from "../lib/atoms/auth";
import { timelineNotesAtom } from "../lib/atoms/timeline";
import type { Note } from "../lib/types/note";

/**
 * Timeline type
 */
export type TimelineType = "home" | "local" | "social";

/**
 * WebSocket connection state atom per timeline type
 */
import { atom } from "jotai";
export const timelineStreamConnectedAtom = atom<Record<TimelineType, boolean>>({
  home: false,
  local: false,
  social: false,
});

// --- Singleton WebSocket Connection Manager per Timeline ---

interface TimelineWSConnection {
  socket: WebSocket | null;
  reconnectTimeout: ReturnType<typeof setTimeout> | null;
  connectionCount: number;
  pingInterval: ReturnType<typeof setInterval> | null;
}

const timelineConnections: Record<TimelineType, TimelineWSConnection> = {
  home: { socket: null, reconnectTimeout: null, connectionCount: 0, pingInterval: null },
  local: { socket: null, reconnectTimeout: null, connectionCount: 0, pingInterval: null },
  social: { socket: null, reconnectTimeout: null, connectionCount: 0, pingInterval: null },
};

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
  onNote: (note: Note) => void,
  onNoteDeleted: (noteId: string) => void,
  onNoteReacted: (event: NoteReactedEvent) => void,
  setConnected: (connected: boolean) => void,
) {
  const connection = timelineConnections[timelineType];

  // Already connected
  if (connection.socket && connection.socket.readyState === WebSocket.OPEN) return;

  // Clear any pending reconnect
  if (connection.reconnectTimeout) {
    clearTimeout(connection.reconnectTimeout);
    connection.reconnectTimeout = null;
  }

  const url = getTimelineWSUrl(timelineType, token);
  const socket = new WebSocket(url);
  connection.socket = socket;

  socket.onopen = () => {
    console.log(`Timeline WebSocket connected: ${timelineType}`);
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
          setConnected(true);
          break;
        case "note":
          onNote(message.data as Note);
          break;
        case "noteDeleted":
          onNoteDeleted(message.data.noteId);
          break;
        case "noteReacted":
          onNoteReacted(message.data as NoteReactedEvent);
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
    console.log(`Timeline WebSocket closed: ${timelineType} (code: ${event.code})`);
    setConnected(false);
    connection.socket = null;

    if (connection.pingInterval) {
      clearInterval(connection.pingInterval);
      connection.pingInterval = null;
    }

    // Reconnect after delay (only if there are still subscribers and not auth error)
    if (connection.connectionCount > 0 && event.code !== 4001) {
      connection.reconnectTimeout = setTimeout(() => {
        connectTimelineWS(timelineType, token, onNote, onNoteDeleted, onNoteReacted, setConnected);
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
function disconnectTimelineWS(
  timelineType: TimelineType,
  setConnected: (connected: boolean) => void,
  force = false,
) {
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
      setConnected(false);
    }
  }
}

/**
 * Hook to subscribe to real-time timeline updates
 *
 * @param timelineType - Type of timeline to subscribe to
 * @param enabled - Whether to enable the stream (default: true)
 *
 * @example
 * ```tsx
 * // In a timeline component
 * const { connected } = useTimelineStream("home");
 *
 * // For local timeline (no auth required)
 * const { connected } = useTimelineStream("local");
 * ```
 */
export function useTimelineStream(timelineType: TimelineType, enabled = true) {
  const setNotes = useAtom(timelineNotesAtom)[1];
  const [connectionState, setConnectionState] = useAtom(timelineStreamConnectedAtom);
  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const token = useAtomValue(tokenAtom);

  // Track if this is the active timeline type
  const isActiveRef = useRef(false);

  /**
   * Set connected state for this timeline type
   */
  const setConnected = useCallback(
    (connected: boolean) => {
      setConnectionState((prev) => ({
        ...prev,
        [timelineType]: connected,
      }));
    },
    [timelineType, setConnectionState],
  );

  /**
   * Handle new note from stream
   */
  const handleNote = useCallback(
    (note: Note) => {
      // Only update if this is the active timeline
      if (!isActiveRef.current) return;

      // Add new note at the beginning, avoiding duplicates
      setNotes((prev) => {
        if (prev.some((n) => n.id === note.id)) {
          return prev;
        }
        return [note, ...prev];
      });
    },
    [setNotes],
  );

  /**
   * Handle note deletion from stream
   */
  const handleNoteDeleted = useCallback(
    (noteId: string) => {
      if (!isActiveRef.current) return;

      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    },
    [setNotes],
  );

  /**
   * Handle note reaction update from stream
   */
  const handleNoteReacted = useCallback(
    (event: NoteReactedEvent) => {
      if (!isActiveRef.current) return;

      // Update the note's reactions in the timeline
      setNotes((prev) =>
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
    },
    [setNotes],
  );

  // Refs to store stable references to latest values
  const tokenRef = useRef(token);
  const isInitializedRef = useRef(false);

  // Keep token ref up to date
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  /**
   * Connect to stream
   */
  const connect = useCallback(() => {
    // Home timeline requires authentication
    if (timelineType === "home" && !isAuthenticated) return;

    connectTimelineWS(timelineType, tokenRef.current, handleNote, handleNoteDeleted, handleNoteReacted, setConnected);
  }, [timelineType, isAuthenticated, handleNote, handleNoteDeleted, handleNoteReacted, setConnected]);

  /**
   * Disconnect from stream
   */
  const disconnect = useCallback(() => {
    disconnectTimelineWS(timelineType, setConnected);
  }, [timelineType, setConnected]);

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
      // Use Promise.resolve to avoid blocking
      Promise.resolve().then(() => {
        connectTimelineWS(timelineType, tokenRef.current, handleNote, handleNoteDeleted, handleNoteReacted, setConnected);
      });
    }

    return () => {
      isActiveRef.current = false;
      connection.connectionCount--;

      // Disconnect when last subscriber unmounts
      if (connection.connectionCount <= 0) {
        connection.connectionCount = 0;
        isInitializedRef.current = false;
        disconnectTimelineWS(timelineType, setConnected, true);
      }
    };
    // Only depend on auth/enabled state changes, not on callback functions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, timelineType, isAuthenticated]);

  // Handle auth state changes
  useEffect(() => {
    if (timelineType === "home" && !isAuthenticated) {
      const connection = timelineConnections[timelineType];
      connection.connectionCount = 0;
      isInitializedRef.current = false;
      disconnectTimelineWS(timelineType, setConnected, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timelineType, isAuthenticated]);

  return {
    connected: connectionState[timelineType],
    connect,
    disconnect,
  };
}

/**
 * Hook to get timeline stream connection status
 */
export function useTimelineStreamStatus(timelineType: TimelineType) {
  const connectionState = useAtomValue(timelineStreamConnectedAtom);
  return connectionState[timelineType];
}
