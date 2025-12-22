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
import { mentionsApi } from "../../../lib/api/mentions";
import { NoteCard } from "../../note/NoteCard";
import { Button } from "../../ui/Button";
import { TimelineSkeleton } from "../../ui/Skeleton";
import { Spinner } from "../../ui/Spinner";
import { ErrorMessage } from "../../ui/ErrorMessage";
import { AnimatedList } from "../../ui/AnimatedList";
import { useInfiniteScroll } from "../../../hooks/useInfiniteScroll";

/**
 * Props for MentionsColumnContent
 */
export interface MentionsColumnContentProps {
  columnId: string;
}

/**
 * Mentions content for deck columns
 *
 * Displays notes that mention the current user.
 */
export function MentionsColumnContent({
  columnId,
}: MentionsColumnContentProps) {
  const state = useAtomValue(columnNotesStateAtomFamily(columnId));
  const updateState = useAtom(updateColumnStateAtomFamily(columnId))[1];
  const appendNotes = useAtom(appendColumnNotesAtomFamily(columnId))[1];
  const removeNote = useAtom(removeColumnNoteAtomFamily(columnId))[1];

  const currentUser = useAtomValue(currentUserAtom);
  const hasLoadedRef = useRef(false);

  const { notes, loading, error, hasMore, cursor } = state;

  // Load initial data function (reusable)
  const loadInitialData = useCallback(async () => {
    updateState({ loading: true, error: null });

    try {
      const data = await mentionsApi.getMentions({ limit: 20 });
      const lastNote = data[data.length - 1];

      updateState({
        notes: data,
        loading: false,
        hasMore: data.length >= 20,
        cursor: lastNote?.id ?? null,
      });
    } catch (err) {
      updateState({
        loading: false,
        error:
          err instanceof Error ? err.message : "Failed to load mentions",
      });
    }
  }, [updateState]);

  // Load initial data on mount
  useEffect(() => {
    if (hasLoadedRef.current || !currentUser) return;
    hasLoadedRef.current = true;
    loadInitialData();
  }, [currentUser, loadInitialData]);

  // TODO: Add real-time updates for mentions
  // Currently not implemented as notification WebSocket only sends noteId, not full note data.
  // Would require additional API call to fetch note details on each mention notification.

  // Load more
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    updateState({ loading: true, error: null });

    try {
      const data = await mentionsApi.getMentions({
        limit: 20,
        untilId: cursor || undefined,
      });

      if (data.length === 0) {
        updateState({ loading: false, hasMore: false });
      } else {
        const lastNote = data[data.length - 1];
        appendNotes(data);
        updateState({
          loading: false,
          cursor: lastNote?.id ?? null,
          hasMore: data.length >= 20,
        });
      }
    } catch (err) {
      updateState({
        loading: false,
        error:
          err instanceof Error ? err.message : "Failed to load mentions",
      });
    }
  }, [loading, hasMore, cursor, updateState, appendNotes]);

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

  // Retry
  const handleRetry = useCallback(() => {
    updateState({ error: null });
    // For initial load failures, directly trigger initial load
    if (notes.length === 0) {
      loadInitialData();
      return;
    }
    loadMore();
  }, [loadMore, loadInitialData, updateState, notes.length]);

  if (!currentUser) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Trans>Please log in to view mentions</Trans>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-2" role="feed" aria-busy={loading}>
      {/* Error */}
      {error && (
        <ErrorMessage
          title={<Trans>Error loading mentions</Trans>}
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

      {/* Sentinel */}
      <div ref={sentinelRef} className="h-2" aria-hidden="true" />

      {/* End */}
      {!hasMore && notes.length > 0 && (
        <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <Trans>No more mentions</Trans>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && notes.length === 0 && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          <div className="text-3xl mb-2">@</div>
          <Trans>No mentions yet</Trans>
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
