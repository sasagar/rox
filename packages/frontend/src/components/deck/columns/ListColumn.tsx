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
import { listsApi } from "../../../lib/api/lists";
import { NoteCard } from "../../note/NoteCard";
import { Button } from "../../ui/Button";
import { TimelineSkeleton } from "../../ui/Skeleton";
import { Spinner } from "../../ui/Spinner";
import { ErrorMessage } from "../../ui/ErrorMessage";
import { AnimatedList } from "../../ui/AnimatedList";
import { useInfiniteScroll } from "../../../hooks/useInfiniteScroll";
import { useListStream } from "../../../hooks/useListStream";

/**
 * Props for ListColumnContent
 */
export interface ListColumnContentProps {
  columnId: string;
  listId: string;
}

/**
 * List timeline content for deck columns
 *
 * Displays notes from members of a specific list.
 */
export function ListColumnContent({
  columnId,
  listId,
}: ListColumnContentProps) {
  const state = useAtomValue(columnNotesStateAtomFamily(columnId));
  const updateState = useAtom(updateColumnStateAtomFamily(columnId))[1];
  const appendNotes = useAtom(appendColumnNotesAtomFamily(columnId))[1];
  const removeNote = useAtom(removeColumnNoteAtomFamily(columnId))[1];

  const currentUser = useAtomValue(currentUserAtom);
  const hasLoadedRef = useRef(false);
  const currentListIdRef = useRef(listId);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { notes, loading, error, hasMore, cursor } = state;

  // Reset when listId changes
  useEffect(() => {
    if (currentListIdRef.current !== listId) {
      // Cancel any ongoing fetch
      abortControllerRef.current?.abort();
      abortControllerRef.current = null;
      currentListIdRef.current = listId;
      hasLoadedRef.current = false;
      updateState({
        notes: [],
        loading: false,
        error: null,
        hasMore: true,
        cursor: null,
      });
    }
  }, [listId, updateState]);

  // Load initial data function (reusable)
  const loadInitialData = useCallback(
    async (signal?: AbortSignal) => {
      updateState({ loading: true, error: null });

      try {
        const data = await listsApi.getTimeline(listId, { limit: 20 });
        // Check if aborted before updating state
        if (signal?.aborted) return;

        const lastNote = data[data.length - 1];

        updateState({
          notes: data,
          loading: false,
          hasMore: data.length >= 20,
          cursor: lastNote?.id ?? null,
        });
      } catch (err) {
        // Ignore abort errors
        if (signal?.aborted) return;
        updateState({
          loading: false,
          error:
            err instanceof Error
              ? err.message
              : "Failed to load list timeline",
        });
      }
    },
    [listId, updateState]
  );

  // Load initial data on mount
  useEffect(() => {
    if (hasLoadedRef.current || !currentUser || !listId) return;
    hasLoadedRef.current = true;

    // Cancel any previous request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    loadInitialData(controller.signal);

    return () => {
      controller.abort();
    };
  }, [currentUser, listId, loadInitialData]);

  // Reload data when state is reset (notes become empty while not loading)
  useEffect(() => {
    if (
      notes.length === 0 &&
      !loading &&
      !error &&
      hasLoadedRef.current &&
      currentUser &&
      listId
    ) {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      loadInitialData(controller.signal);
    }
  }, [notes.length, loading, error, currentUser, listId, loadInitialData]);

  // Enable real-time updates via WebSocket
  useListStream({
    columnId,
    listId,
    enabled: !!currentUser && !!listId,
  });

  // Load more
  const loadMore = useCallback(async () => {
    if (loading || !hasMore || !listId) return;

    updateState({ loading: true, error: null });

    try {
      const data = await listsApi.getTimeline(listId, {
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
          err instanceof Error
            ? err.message
            : "Failed to load list timeline",
      });
    }
  }, [loading, hasMore, cursor, listId, updateState, appendNotes]);

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
    // For initial load failures, reload from scratch
    if (notes.length === 0) {
      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;
      loadInitialData(controller.signal);
      return;
    }
    loadMore();
  }, [loadMore, loadInitialData, updateState, notes.length]);

  if (!currentUser) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Trans>Please log in to view list</Trans>
      </div>
    );
  }

  if (!listId) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Trans>No list selected</Trans>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-2" role="feed" aria-busy={loading}>
      {/* Error */}
      {error && (
        <ErrorMessage
          title={<Trans>Error loading list</Trans>}
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
          <Trans>End of list</Trans>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && notes.length === 0 && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          <div className="text-3xl mb-2">📋</div>
          <Trans>No notes in this list</Trans>
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
