"use client";

/**
 * Mention Stream Hook for real-time mention updates in deck view
 *
 * This hook listens to the notification WebSocket and filters for mention/reply
 * notifications, then fetches the full note data to display in the mentions column.
 *
 * Uses the notification WebSocket singleton to avoid multiple connections.
 */

import { useEffect, useRef, useCallback } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { tokenAtom, isAuthenticatedAtom } from "../lib/atoms/auth";
import { prependColumnNotesAtomFamily } from "../lib/atoms/column";
import { notesApi } from "../lib/api/notes";
import type { Notification } from "../lib/types/notification";
import type { Note } from "../lib/types/note";

// Re-use the notification WebSocket connection from useNotificationStream
// We'll register a callback that filters for mention/reply notifications

// Import the notification connection state
import {
  registerMentionCallback,
  unregisterMentionCallback,
} from "./useNotificationStream";

/**
 * Options for useMentionStream hook
 */
export interface UseMentionStreamOptions {
  /** Whether to enable the stream (default: true) */
  enabled?: boolean;
  /** Column ID for deck view - required */
  columnId: string;
  /** Callback when a new mention note is received */
  onNewMention?: (note: Note) => void;
}

/**
 * Hook to subscribe to real-time mention updates for deck columns
 *
 * Listens to notification WebSocket for mention/reply notifications,
 * fetches the full note data, and updates the column-scoped atoms.
 *
 * @param options - Stream options including columnId
 *
 * @example
 * ```tsx
 * // In a mentions column component
 * useMentionStream({
 *   columnId: "col-123",
 *   onNewMention: (note) => console.log("New mention:", note),
 * });
 * ```
 */
export function useMentionStream(options: UseMentionStreamOptions) {
  const { enabled = true, columnId, onNewMention } = options;

  // Column-scoped atom setter for notes
  const prependColumnNotes = useSetAtom(prependColumnNotesAtomFamily(columnId));

  const isAuthenticated = useAtomValue(isAuthenticatedAtom);
  const token = useAtomValue(tokenAtom);

  // Refs to store stable references
  const prependNotesRef = useRef(prependColumnNotes);
  const onNewMentionRef = useRef(onNewMention);
  // Track note IDs already in the column to avoid duplicates
  const processedNoteIdsRef = useRef(new Set<string>());

  // Keep refs up to date
  useEffect(() => {
    prependNotesRef.current = prependColumnNotes;
    onNewMentionRef.current = onNewMention;
  }, [prependColumnNotes, onNewMention]);

  // Handle incoming mention notifications
  const handleMentionNotification = useCallback(
    async (notification: Notification) => {
      // Only process mention and reply notifications
      if (notification.type !== "mention" && notification.type !== "reply") {
        return;
      }

      // Must have a noteId
      if (!notification.noteId) {
        return;
      }

      // Skip if already processed (avoid duplicates)
      if (processedNoteIdsRef.current.has(notification.noteId)) {
        return;
      }

      try {
        // Fetch the full note data
        const note = await notesApi.getNote(notification.noteId);

        // Mark as processed
        processedNoteIdsRef.current.add(note.id);

        // Limit the size of the processed set to prevent memory leaks
        if (processedNoteIdsRef.current.size > 1000) {
          const entries = Array.from(processedNoteIdsRef.current);
          processedNoteIdsRef.current = new Set(entries.slice(-500));
        }

        // Update column-scoped atom
        prependNotesRef.current([note]);

        // Call user callback
        onNewMentionRef.current?.(note);
      } catch (error) {
        console.error("Failed to fetch mention note:", error);
      }
    },
    []
  );

  // Register callback with the notification stream
  useEffect(() => {
    if (!enabled || !columnId || !isAuthenticated || !token) return;

    // Register our callback
    registerMentionCallback(columnId, handleMentionNotification);

    return () => {
      unregisterMentionCallback(columnId);
    };
  }, [enabled, columnId, isAuthenticated, token, handleMentionNotification]);

  // Clear processed IDs when column changes
  useEffect(() => {
    processedNoteIdsRef.current.clear();
  }, [columnId]);
}
