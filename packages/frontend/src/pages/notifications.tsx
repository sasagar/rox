"use client";

/**
 * Notifications page component
 *
 * Full-page view of all notifications with filtering options
 */

import { useState, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { useAtom, useAtomValue } from "jotai";
import { Bell, CheckCheck, Filter, Loader2 } from "lucide-react";
import { Layout } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/PageHeader";
import { NotificationItem } from "../components/notification/NotificationItem";
import { useNotifications } from "../hooks/useNotifications";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { currentUserAtom, tokenAtom } from "../lib/atoms/auth";
import { apiClient } from "../lib/api/client";
import type { Notification, NotificationType } from "../lib/types/notification";

/**
 * Filter options for notifications
 */
interface NotificationFilters {
  types: NotificationType[];
  unreadOnly: boolean;
}

/**
 * Available notification type filters
 */
const NOTIFICATION_TYPE_FILTERS: { type: NotificationType; labelKey: string }[] = [
  { type: "follow", labelKey: "Follow" },
  { type: "mention", labelKey: "Mention" },
  { type: "reply", labelKey: "Reply" },
  { type: "reaction", labelKey: "Reaction" },
  { type: "renote", labelKey: "Renote" },
  { type: "quote", labelKey: "Quote" },
];

export default function NotificationsPage() {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const token = useAtomValue(tokenAtom);
  const [isLoading, setIsLoading] = useState(true);

  const { notifications, loading, markAsRead, markAllAsRead, loadMore } = useNotifications();

  const [hasMore, setHasMore] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<NotificationFilters>({
    types: [],
    unreadOnly: false,
  });

  // Restore user session on mount
  useEffect(() => {
    const restoreSession = async () => {
      if (!token) {
        window.location.href = "/login";
        return;
      }

      if (!currentUser) {
        try {
          apiClient.setToken(token);
          const response = await apiClient.get<{ user: any }>("/api/auth/session");
          setCurrentUser(response.user);
          setIsLoading(false);
        } catch (error) {
          console.error("Failed to restore session:", error);
          window.location.href = "/login";
          return;
        }
      } else {
        setIsLoading(false);
      }
    };
    restoreSession();
  }, [token, currentUser, setCurrentUser]);

  const loadMoreRef = useInfiniteScroll({
    onLoadMore: async () => {
      const prevCount = notifications.length;
      await loadMore();
      if (notifications.length === prevCount) {
        setHasMore(false);
      }
    },
    isLoading: loading,
    hasMore,
  });

  /**
   * Handle notification click - navigate to relevant page
   */
  const handleNotificationClick = (notification: Notification) => {
    if (notification.noteId) {
      window.location.href = `/notes/${notification.noteId}`;
    } else if (notification.notifier) {
      const host = notification.notifier.host;
      const username = notification.notifier.username;
      if (host) {
        window.location.href = `/@${username}@${host}`;
      } else {
        window.location.href = `/@${username}`;
      }
    }
  };

  /**
   * Toggle a notification type filter
   */
  const toggleTypeFilter = (type: NotificationType) => {
    setFilters((prev) => ({
      ...prev,
      types: prev.types.includes(type)
        ? prev.types.filter((t) => t !== type)
        : [...prev.types, type],
    }));
  };

  /**
   * Toggle unread only filter
   */
  const toggleUnreadOnly = () => {
    setFilters((prev) => ({
      ...prev,
      unreadOnly: !prev.unreadOnly,
    }));
  };

  /**
   * Clear all filters
   */
  const clearFilters = () => {
    setFilters({ types: [], unreadOnly: false });
  };

  /**
   * Filter notifications based on current filters
   */
  const filteredNotifications = notifications.filter((notification) => {
    // Filter by type
    if (filters.types.length > 0 && !filters.types.includes(notification.type)) {
      return false;
    }
    // Filter by read status
    if (filters.unreadOnly && notification.isRead) {
      return false;
    }
    return true;
  });

  const hasActiveFilters = filters.types.length > 0 || filters.unreadOnly;
  const hasUnread = notifications.some((n) => !n.isRead);

  // Show loading while checking auth
  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-primary)">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  // Build actions for PageHeader
  const headerActions = [];
  if (hasUnread) {
    headerActions.push({
      key: "mark-all-read",
      label: <Trans>Mark all as read</Trans>,
      icon: <CheckCheck className="w-4 h-4" />,
      onPress: markAllAsRead,
    });
  }
  headerActions.push({
    key: "filter",
    label: <Trans>Filter</Trans>,
    icon: <Filter className="w-4 h-4" />,
    onPress: () => setShowFilters(!showFilters),
    variant: hasActiveFilters ? "primary" : "secondary",
  });

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title={<Trans>Notifications</Trans>}
          icon={<Bell className="w-6 h-6" />}
          actions={headerActions as any}
        />

        {/* Filters Panel */}
        {showFilters && (
          <div className="mb-6 p-4 bg-(--card-bg) rounded-lg border border-(--border-color)">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-(--text-primary)">
                <Trans>Filter notifications</Trans>
              </h3>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="text-xs text-(--text-muted) hover:text-(--text-primary)"
                >
                  <Trans>Clear all</Trans>
                </button>
              )}
            </div>

            {/* Type filters */}
            <div className="mb-4">
              <p className="text-xs text-(--text-muted) mb-2">
                <Trans>By type</Trans>
              </p>
              <div className="flex flex-wrap gap-2">
                {NOTIFICATION_TYPE_FILTERS.map(({ type, labelKey }) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => toggleTypeFilter(type)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      filters.types.includes(type)
                        ? "bg-primary-500 text-white"
                        : "bg-(--bg-secondary) text-(--text-secondary) hover:bg-(--bg-tertiary)"
                    }`}
                  >
                    {labelKey === "Follow" && <Trans>Follow</Trans>}
                    {labelKey === "Mention" && <Trans>Mention</Trans>}
                    {labelKey === "Reply" && <Trans>Reply</Trans>}
                    {labelKey === "Reaction" && <Trans>Reaction</Trans>}
                    {labelKey === "Renote" && <Trans>Renote</Trans>}
                    {labelKey === "Quote" && <Trans>Quote</Trans>}
                  </button>
                ))}
              </div>
            </div>

            {/* Unread only filter */}
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.unreadOnly}
                  onChange={toggleUnreadOnly}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-(--text-secondary)">
                  <Trans>Show unread only</Trans>
                </span>
              </label>
            </div>
          </div>
        )}

        {/* Notifications List */}
        <div className="bg-(--card-bg) rounded-lg border border-(--border-color) overflow-hidden">
          {filteredNotifications.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-(--text-muted)">
              <Bell className="w-12 h-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {hasActiveFilters ? (
                  <Trans>No matching notifications</Trans>
                ) : (
                  <Trans>No notifications</Trans>
                )}
              </p>
              <p className="text-sm mt-1">
                {hasActiveFilters ? (
                  <Trans>Try adjusting your filters</Trans>
                ) : (
                  <Trans>You're all caught up!</Trans>
                )}
              </p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-(--border-color)">
                {filteredNotifications.map((notification) => (
                  <NotificationItem
                    key={notification.id}
                    notification={notification}
                    onMarkAsRead={markAsRead}
                    onClick={handleNotificationClick}
                  />
                ))}
              </div>

              {/* Load more trigger */}
              <div ref={loadMoreRef} className="h-12 flex items-center justify-center">
                {loading && <Loader2 className="w-5 h-5 animate-spin text-(--text-muted)" />}
              </div>
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
