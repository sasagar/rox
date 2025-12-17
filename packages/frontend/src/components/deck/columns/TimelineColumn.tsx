"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Trans } from "@lingui/react/macro";
import {
  columnNotesStateAtomFamily,
  updateColumnStateAtomFamily,
  appendColumnNotesAtomFamily,
  removeColumnNoteAtomFamily,
} from "../../../lib/atoms/column";
import { currentUserAtom } from "../../../lib/atoms/auth";
import {
  notificationSoundAtom,
  notificationVolumeAtom,
} from "../../../lib/atoms/uiSettings";
import { notesApi } from "../../../lib/api/notes";
import { NoteCard } from "../../note/NoteCard";
import { Button } from "../../ui/Button";
import { TimelineSkeleton } from "../../ui/Skeleton";
import { Spinner } from "../../ui/Spinner";
import { ErrorMessage } from "../../ui/ErrorMessage";
import { AnimatedList } from "../../ui/AnimatedList";
import { useInfiniteScroll } from "../../../hooks/useInfiniteScroll";
import {
  useTimelineStream,
  type TimelineType as StreamTimelineType,
} from "../../../hooks/useTimelineStream";
import { playNotificationSound } from "../../../lib/utils/notificationSound";
import type { TimelineType } from "../../../lib/types/deck";

/**
 * Props for TimelineColumnContent
 */
export interface TimelineColumnContentProps {
  columnId: string;
  timelineType: TimelineType;
}

/**
 * Timeline content for deck columns
 *
 * Uses column-scoped state via atomFamily to allow multiple
 * timeline columns to coexist with independent data.
 */
export function TimelineColumnContent({
  columnId,
  timelineType,
}: TimelineColumnContentProps) {
  const state = useAtomValue(columnNotesStateAtomFamily(columnId));
  const updateState = useAtom(updateColumnStateAtomFamily(columnId))[1];
  const appendNotes = useAtom(appendColumnNotesAtomFamily(columnId))[1];
  const removeNote = useAtom(removeColumnNoteAtomFamily(columnId))[1];

  const currentUser = useAtomValue(currentUserAtom);
  const notificationSound = useAtomValue(notificationSoundAtom);
  const notificationVolume = useAtomValue(notificationVolumeAtom);

  const containerRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  const { notes, loading, error, hasMore, cursor } = state;

  // Callback for new note received via WebSocket
  const handleNewNote = useCallback(
    (note: { user: { id: string } }) => {
      // Don't play sound for own notes
      if (currentUser && note.user.id === currentUser.id) {
        return;
      }
      playNotificationSound(notificationSound, notificationVolume);
    },
    [currentUser, notificationSound, notificationVolume]
  );

  // Map timeline type to stream type
  const streamType: StreamTimelineType =
    timelineType === "home"
      ? "home"
      : timelineType === "social"
        ? "social"
        : "local";

  // Enable real-time updates
  useTimelineStream(streamType, { enabled: true, onNewNote: handleNewNote });

  // Load initial data
  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadInitialData = async () => {
      updateState({ loading: true, error: null });

      try {
        const fetchFunction =
          timelineType === "home"
            ? notesApi.getHomeTimeline
            : timelineType === "social"
              ? notesApi.getSocialTimeline
              : timelineType === "global"
                ? notesApi.getGlobalTimeline
                : notesApi.getLocalTimeline;

        const newNotes = await fetchFunction({ limit: 20 });
        const lastNote = newNotes[newNotes.length - 1];

        updateState({
          notes: newNotes,
          loading: false,
          hasMore: newNotes.length >= 20,
          cursor: lastNote?.id ?? null,
        });
      } catch (err) {
        updateState({
          loading: false,
          error: err instanceof Error ? err.message : "Failed to load notes",
        });
      }
    };

    loadInitialData();
  }, [timelineType, updateState]);

  // Load more notes for pagination
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    updateState({ loading: true, error: null });

    try {
      const fetchFunction =
        timelineType === "home"
          ? notesApi.getHomeTimeline
          : timelineType === "social"
            ? notesApi.getSocialTimeline
            : timelineType === "global"
              ? notesApi.getGlobalTimeline
              : notesApi.getLocalTimeline;

      const newNotes = await fetchFunction({
        limit: 20,
        untilId: cursor || undefined,
      });

      if (newNotes.length === 0) {
        updateState({ loading: false, hasMore: false });
      } else {
        const lastNote = newNotes[newNotes.length - 1];
        appendNotes(newNotes);
        updateState({
          loading: false,
          cursor: lastNote?.id ?? null,
          hasMore: newNotes.length >= 20,
        });
      }
    } catch (err) {
      updateState({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load notes",
      });
    }
  }, [loading, hasMore, cursor, timelineType, updateState, appendNotes]);

  // Infinite scroll
  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    isLoading: loading,
    hasMore,
    threshold: 0.1,
    rootMargin: "100px",
  });

  // Handle note deletion
  const handleNoteDelete = useCallback(
    (noteId: string) => {
      removeNote(noteId);
    },
    [removeNote]
  );

  // Retry on error
  const handleRetry = useCallback(() => {
    updateState({ error: null });
    // For initial load failures, reset and reload from scratch
    if (notes.length === 0) {
      hasLoadedRef.current = false;
      updateState({ hasMore: true });
    }
    loadMore();
  }, [loadMore, updateState, notes.length]);

  return (
    <div
      ref={containerRef}
      className="space-y-3 p-2"
      role="feed"
      aria-busy={loading}
      aria-label={`${timelineType} timeline`}
    >
      {/* Error */}
      {error && (
        <ErrorMessage
          title={<Trans>Error loading timeline</Trans>}
          message={error}
          onRetry={handleRetry}
          isRetrying={loading}
          variant="error"
        />
      )}

      {/* Initial Loading */}
      {!error && loading && notes.length === 0 && (
        <TimelineSkeleton count={3} />
      )}

      {/* Notes List */}
      <AnimatedList
        items={notes}
        keyExtractor={(note) => note.id}
        className="space-y-3"
        renderItem={(note) => (
          <NoteCard
            note={note}
            onDelete={() => handleNoteDelete(note.id)}
          />
        )}
      />

      {/* Loading More */}
      {loading && notes.length > 0 && (
        <div className="flex justify-center py-4">
          <Spinner size="md" />
        </div>
      )}

      {/* Sentinel for infinite scroll */}
      <div ref={sentinelRef} className="h-2" aria-hidden="true" />

      {/* End of timeline */}
      {!hasMore && notes.length > 0 && (
        <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <Trans>End of timeline</Trans>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && notes.length === 0 && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          <div className="text-3xl mb-2">📭</div>
          <Trans>No notes yet</Trans>
        </div>
      )}

      {/* Manual load more */}
      {hasMore && !loading && notes.length > 0 && (
        <div className="flex justify-center py-2">
          <Button variant="ghost" size="sm" onPress={loadMore}>
            <Trans>Load more</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}
