"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Trans } from "@lingui/react/macro";
import {
  timelineNotesAtom,
  timelineLoadingAtom,
  timelineErrorAtom,
  timelineHasMoreAtom,
  timelineLastNoteIdAtom,
} from "../../lib/atoms/timeline";
import { notesApi } from "../../lib/api/notes";
import { NoteCard } from "../note/NoteCard";
import { Button } from "../ui/Button";
import { TimelineSkeleton } from "../ui/Skeleton";
import { Spinner } from "../ui/Spinner";
import { ErrorMessage } from "../ui/ErrorMessage";
import { ScrollToTop } from "../ui/ScrollToTop";
import { useInfiniteScroll } from "../../hooks/useInfiniteScroll";
import { useKeyboardNavigation } from "../../hooks/useKeyboardNavigation";
import { useTimelineStream, type TimelineType as StreamTimelineType } from "../../hooks/useTimelineStream";

/**
 * Props for the Timeline component
 */
export interface TimelineProps {
  /** Timeline type: 'local' | 'social' | 'global' | 'home' */
  type?: "local" | "social" | "global" | "home";
}

/**
 * Timeline component for displaying a feed of notes
 * Supports infinite scroll pagination and real-time updates
 *
 * @param type - Timeline type (local/social/global/home)
 */
export function Timeline({ type = "local" }: TimelineProps) {
  const [notes, setNotes] = useAtom(timelineNotesAtom);
  const [loading, setLoading] = useAtom(timelineLoadingAtom);
  const [error, setError] = useAtom(timelineErrorAtom);
  const [hasMore, setHasMore] = useAtom(timelineHasMoreAtom);
  const lastNoteId = useAtomValue(timelineLastNoteIdAtom);

  const timelineContainerRef = useRef<HTMLDivElement>(null);
  const hasLoadedRef = useRef(false);

  // Enable real-time updates via SSE for supported timeline types
  // "global" type maps to "local" stream since global includes all public notes
  const streamType: StreamTimelineType | null =
    type === "home" ? "home" : type === "social" ? "social" : type === "local" ? "local" : "local";
  useTimelineStream(streamType, true);

  // Reset and load data when type changes (component remounts via key)
  useEffect(() => {
    // Reset state on mount
    setNotes([]);
    setError(null);
    setHasMore(true);
    setLoading(true);
    hasLoadedRef.current = false;

    // Load initial data
    const loadInitialData = async () => {
      try {
        const fetchFunction =
          type === "home"
            ? notesApi.getHomeTimeline
            : type === "social"
              ? notesApi.getSocialTimeline
              : type === "global"
                ? notesApi.getGlobalTimeline
                : notesApi.getLocalTimeline;

        const newNotes = await fetchFunction({ limit: 20 });
        setNotes(newNotes);
        setHasMore(newNotes.length >= 20);
        hasLoadedRef.current = true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load notes");
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();
  }, [type, setNotes, setError, setHasMore, setLoading]);

  // Keyboard navigation for timeline
  useKeyboardNavigation(timelineContainerRef, {
    enabled: notes.length > 0,
    itemSelector: '[role="article"]',
  });

  // Load more notes for pagination
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const fetchFunction =
        type === "home"
          ? notesApi.getHomeTimeline
          : type === "social"
            ? notesApi.getSocialTimeline
            : type === "global"
              ? notesApi.getGlobalTimeline
              : notesApi.getLocalTimeline;

      const newNotes = await fetchFunction({
        limit: 20,
        untilId: lastNoteId || undefined,
      });

      if (newNotes.length === 0) {
        setHasMore(false);
      } else {
        setNotes((prev) => [...prev, ...newNotes]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [loading, hasMore, lastNoteId, type, setLoading, setError, setHasMore, setNotes]);

  // Use the reusable infinite scroll hook
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
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
    },
    [setNotes],
  );

  // Retry function for error recovery
  const handleRetry = useCallback(() => {
    setError(null);
    loadMore();
  }, [loadMore, setError]);

  return (
    <div
      ref={timelineContainerRef}
      className="space-y-4"
      role="feed"
      aria-busy={loading}
      aria-label={`${type} timeline`}
    >
      {/* Enhanced Error Message with Retry */}
      {error && (
        <ErrorMessage
          title={<Trans>Error loading timeline</Trans>}
          message={error}
          onRetry={handleRetry}
          isRetrying={loading}
          variant="error"
        />
      )}

      {/* Initial Loading State - Show skeleton */}
      {!error && loading && notes.length === 0 && (
        <div role="status" aria-label="Loading timeline">
          <TimelineSkeleton count={3} />
          <span className="sr-only">
            <Trans>Loading posts...</Trans>
          </span>
        </div>
      )}

      {/* Notes List */}
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onDelete={() => handleNoteDelete(note.id)} />
      ))}

      {/* Loading More Indicator - Show spinner when loading additional notes */}
      {loading && notes.length > 0 && (
        <div className="flex justify-center py-8" role="status" aria-label="Loading more posts">
          <Spinner size="lg" />
          <span className="sr-only">
            <Trans>Loading more posts...</Trans>
          </span>
        </div>
      )}

      {/* Load More Trigger (Intersection Observer Target) */}
      <div ref={sentinelRef} className="h-4" aria-hidden="true" />

      {/* End of Timeline */}
      {!hasMore && notes.length > 0 && (
        <div
          className="py-8 text-center text-gray-500 dark:text-gray-400"
          role="status"
          aria-live="polite"
        >
          <Trans>You've reached the end of the timeline</Trans>
        </div>
      )}

      {/* Empty State */}
      {!loading && notes.length === 0 && (
        <div
          className="rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 p-12 text-center"
          role="status"
        >
          <div className="text-4xl mb-4" aria-hidden="true">
            📭
          </div>
          <h3 className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
            <Trans>No notes yet</Trans>
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            <Trans>Be the first to post something!</Trans>
          </p>
        </div>
      )}

      {/* Manual Load More Button (fallback) */}
      {hasMore && !loading && notes.length > 0 && (
        <div className="flex justify-center py-4">
          <Button variant="secondary" onPress={loadMore} aria-label="Load more posts manually">
            <Trans>Load more</Trans>
          </Button>
        </div>
      )}

      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
  );
}
