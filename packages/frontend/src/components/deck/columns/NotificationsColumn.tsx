"use client";

import { useEffect, useCallback, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Trans } from "@lingui/react/macro";
import {
  columnNotificationsStateAtomFamily,
  updateNotificationColumnStateAtomFamily,
  appendColumnNotificationsAtomFamily,
} from "../../../lib/atoms/column";
import { currentUserAtom } from "../../../lib/atoms/auth";
import { notificationsApi } from "../../../lib/api/notifications";
import { NotificationItem } from "../../notification/NotificationItem";
import { Button } from "../../ui/Button";
import { Spinner } from "../../ui/Spinner";
import { ErrorMessage } from "../../ui/ErrorMessage";
import { useInfiniteScroll } from "../../../hooks/useInfiniteScroll";

/**
 * Props for NotificationsColumnContent
 */
export interface NotificationsColumnContentProps {
  columnId: string;
}

/**
 * Notifications content for deck columns
 */
export function NotificationsColumnContent({
  columnId,
}: NotificationsColumnContentProps) {
  const state = useAtomValue(
    columnNotificationsStateAtomFamily(columnId)
  );
  const updateState = useAtom(
    updateNotificationColumnStateAtomFamily(columnId)
  )[1];
  const appendNotifications = useAtom(
    appendColumnNotificationsAtomFamily(columnId)
  )[1];

  const currentUser = useAtomValue(currentUserAtom);
  const hasLoadedRef = useRef(false);

  const { notifications, loading, error, hasMore, cursor } = state;

  // Load initial data
  useEffect(() => {
    if (hasLoadedRef.current || !currentUser) return;
    hasLoadedRef.current = true;

    const loadInitialData = async () => {
      updateState({ loading: true, error: null });

      try {
        const data = await notificationsApi.getNotifications({ limit: 20 });
        const lastItem = data[data.length - 1];

        updateState({
          notifications: data,
          loading: false,
          hasMore: data.length >= 20,
          cursor: lastItem?.id ?? null,
        });
      } catch (err) {
        updateState({
          loading: false,
          error:
            err instanceof Error ? err.message : "Failed to load notifications",
        });
      }
    };

    loadInitialData();
  }, [currentUser, updateState]);

  // Load more
  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;

    updateState({ loading: true, error: null });

    try {
      const data = await notificationsApi.getNotifications({
        limit: 20,
        untilId: cursor || undefined,
      });

      if (data.length === 0) {
        updateState({ loading: false, hasMore: false });
      } else {
        const lastItem = data[data.length - 1];
        appendNotifications(data);
        updateState({
          loading: false,
          cursor: lastItem?.id ?? null,
          hasMore: data.length >= 20,
        });
      }
    } catch (err) {
      updateState({
        loading: false,
        error:
          err instanceof Error ? err.message : "Failed to load notifications",
      });
    }
  }, [loading, hasMore, cursor, updateState, appendNotifications]);

  // Infinite scroll
  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    isLoading: loading,
    hasMore,
    threshold: 0.1,
    rootMargin: "100px",
  });

  // Retry
  const handleRetry = useCallback(() => {
    updateState({ error: null });
    loadMore();
  }, [loadMore, updateState]);

  if (!currentUser) {
    return (
      <div className="p-4 text-center text-gray-500">
        <Trans>Please log in to view notifications</Trans>
      </div>
    );
  }

  return (
    <div className="p-2" role="feed" aria-busy={loading}>
      {/* Error */}
      {error && (
        <ErrorMessage
          title={<Trans>Error loading notifications</Trans>}
          message={error}
          onRetry={handleRetry}
          isRetrying={loading}
          variant="error"
        />
      )}

      {/* Initial Loading */}
      {!error && loading && notifications.length === 0 && (
        <div className="flex justify-center py-8">
          <Spinner size="md" />
        </div>
      )}

      {/* Notifications List */}
      <div className="space-y-1">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
          />
        ))}
      </div>

      {/* Loading More */}
      {loading && notifications.length > 0 && (
        <div className="flex justify-center py-4">
          <Spinner size="md" />
        </div>
      )}

      {/* Sentinel */}
      <div ref={sentinelRef} className="h-2" aria-hidden="true" />

      {/* End */}
      {!hasMore && notifications.length > 0 && (
        <div className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
          <Trans>No more notifications</Trans>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && notifications.length === 0 && (
        <div className="py-8 text-center text-gray-500 dark:text-gray-400">
          <div className="text-3xl mb-2">🔔</div>
          <Trans>No notifications yet</Trans>
        </div>
      )}

      {/* Manual load more */}
      {hasMore && !loading && notifications.length > 0 && (
        <div className="flex justify-center py-2">
          <Button variant="ghost" size="sm" onPress={loadMore}>
            <Trans>Load more</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}
