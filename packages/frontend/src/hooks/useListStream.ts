"use client";

/**
 * List Stream Hook for real-time list timeline updates in deck view
 *
 * This hook provides WebSocket-based real-time updates for list timelines
 * specifically designed for deck columns. It manages a WebSocket connection
 * per list and updates column-scoped atoms.
 *
 * Unlike notification stream which uses a singleton, each list requires
 * its own WebSocket connection since lists are user-specific.
 */

import { useEffect, useCallback, useRef, useState } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { tokenAtom, isAuthenticatedAtom } from "../lib/atoms/auth";
import { prependColumnNotesAtomFamily } from "../lib/atoms/column";
import type { Note } from "../lib/types/note";

// WebSocket connection constants
const PING_INTERVAL_MS = 25000; // 25 seconds
const INITIAL_RECONNECT_DELAY_MS = 1000; // 1 second
const MAX_RECONNECT_DELAY_MS = 60000; // 60 seconds

// WebSocket close codes - custom codes for specific error conditions
const WS_CLOSE_AUTH_REQUIRED = 4001;
const WS_CLOSE_ACCESS_DENIED = 4003;
const WS_CLOSE_NOT_FOUND = 4004;

/**
 * Options for useListStream hook
 */
export interface UseListStreamOptions {
  /** Whether to enable the stream (default: true) */
  enabled?: boolean;
  /** Column ID for deck view - required */
  columnId: string;
  /** List ID to subscribe to - required */
  listId: string;
  /** Callback when a new note is received */
  onNewNote?: (note: Note) => void;
}

/**
 * Get WebSocket endpoint URL for list timeline
 *
 * Note: Token is passed via query parameter, which is a common pattern for WebSocket auth.
 * While this may be logged in server access logs, the connection uses WSS (encrypted)
 * in production, making this approach acceptable.
 *
 * @param listId - List ID to connect to
 * @param token - Authentication token
 * @returns WebSocket URL with token
 */
function getListWSUrl(listId: string, token: string): string {
  const protocol =
    typeof window !== "undefined" && window.location.protocol === "https:"
      ? "wss:"
      : "ws:";
  const host = typeof window !== "undefined" ? window.location.host : "";
  return `${protocol}//${host}/ws/list/${listId}?token=${encodeURIComponent(token)}`;
}

/**
 * Hook to subscribe to real-time list timeline updates for deck columns
 *
 * @param options - Stream options including columnId and listId
 *
 * @returns Object containing connection state and control functions
 *
 * @example
 * ```tsx
 * // In a list column component
 * const { connected } = useListStream({
 *   columnId: "col-123",
 *   listId: "list-456",
 *   onNewNote: (note) => console.log("New note:", note),
 * });
 * ```
 */
export function useListStream(options: UseListStreamOptions): {
  /** Whether WebSocket is currently connected */
  connected: boolean;
  /** Manually connect to WebSocket */
  connect: () => void;
  /** Manually disconnect from WebSocket */
  disconnect: () => void;
} {
  const { enabled = true, columnId, listId, onNewNote } = options;

  // Column-scoped atom setter for notes
  const prependColumnNotes = useSetAtom(prependColumnNotesAtomFamily(columnId));

  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const token = useAtomValue(tokenAtom);

  // Local state for connection status
  const [connected, setConnected] = useState(false);

  // Refs
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const prependNotesRef = useRef(prependColumnNotes);
  const onNewNoteRef = useRef(onNewNote);
  const tokenRef = useRef(token);

  // Keep refs up to date
  useEffect(() => {
    prependNotesRef.current = prependColumnNotes;
    onNewNoteRef.current = onNewNote;
    tokenRef.current = token;
  }, [prependColumnNotes, onNewNote, token]);

  // Connect to WebSocket
  const connect = useCallback(() => {
    if (!tokenRef.current || !listId) return;

    // Already connected or connecting
    if (
      socketRef.current &&
      (socketRef.current.readyState === WebSocket.OPEN ||
        socketRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const url = getListWSUrl(listId, tokenRef.current);
    const socket = new WebSocket(url);
    socketRef.current = socket;

    socket.onopen = () => {
      // Reset reconnect attempts on successful connection
      reconnectAttemptsRef.current = 0;

      // Start ping interval to keep connection alive
      pingIntervalRef.current = setInterval(() => {
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
            setConnected(true);
            break;
          case "note": {
            const note = message.data as Note;
            // Validate required note fields
            if (
              !note ||
              typeof note.id !== "string" ||
              typeof note.userId !== "string" ||
              typeof note.createdAt !== "string"
            ) {
              console.warn("Received malformed note:", message.data);
              break;
            }
            // Update column-scoped atom
            prependNotesRef.current([note]);
            // Call user callback
            onNewNoteRef.current?.(note);
            break;
          }
          case "heartbeat":
          case "pong":
            // Connection is alive
            break;
          case "error":
            console.error("List WebSocket error:", message.data);
            break;
        }
      } catch (error) {
        console.error("Failed to parse WebSocket message:", error);
      }
    };

    socket.onclose = (event) => {
      setConnected(false);
      socketRef.current = null;

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // Reconnect with exponential backoff (unless auth error or intentional close)
      const isAuthError =
        event.code === WS_CLOSE_AUTH_REQUIRED ||
        event.code === WS_CLOSE_ACCESS_DENIED ||
        event.code === WS_CLOSE_NOT_FOUND;

      if (!isAuthError) {
        const delay = Math.min(
          INITIAL_RECONNECT_DELAY_MS * Math.pow(2, reconnectAttemptsRef.current),
          MAX_RECONNECT_DELAY_MS
        );
        reconnectAttemptsRef.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (tokenRef.current) {
            connect();
          }
        }, delay);
      }
    };

    socket.onerror = (error) => {
      console.warn("List WebSocket error:", error);
    };
  }, [listId]);

  // Disconnect from WebSocket
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
      setConnected(false);
    }
  }, []);

  // Manage WebSocket connection lifecycle
  // Note: The cleanup function handles disconnect when isAuthenticated changes,
  // so a separate effect for logout is not needed.
  useEffect(() => {
    if (!enabled || !isAuthenticated || !listId) return;

    connect();

    return () => {
      disconnect();
    };
  }, [enabled, isAuthenticated, listId, connect, disconnect]);

  return {
    connected,
    connect,
    disconnect,
  };
}
