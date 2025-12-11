"use client";

/**
 * Mentions page component
 *
 * Full-page view of mentions and replies to the user
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Trans } from "@lingui/react/macro";
import { useAtom, useAtomValue } from "jotai";
import { AtSign, Loader2 } from "lucide-react";
import { Layout } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/PageHeader";
import { NoteCard } from "../components/note/NoteCard";
import { useMentions } from "../hooks/useMentions";
import { useInfiniteScroll } from "../hooks/useInfiniteScroll";
import { currentUserAtom, tokenAtom } from "../lib/atoms/auth";
import { apiClient } from "../lib/api/client";
import { TimelineSkeleton } from "../components/ui/Skeleton";
import { ScrollToTop } from "../components/ui/ScrollToTop";
import { AnimatedList } from "../components/ui/AnimatedList";

export default function MentionsPage() {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const token = useAtomValue(tokenAtom);
  const [isLoading, setIsLoading] = useState(true);

  const { mentions, loading, hasMore, fetchMentions, loadMore } = useMentions();

  const timelineContainerRef = useRef<HTMLDivElement>(null);

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

  // Fetch mentions on load
  useEffect(() => {
    if (!isLoading && currentUser) {
      fetchMentions();
    }
  }, [isLoading, currentUser, fetchMentions]);

  const sentinelRef = useInfiniteScroll({
    onLoadMore: loadMore,
    isLoading: loading,
    hasMore,
    threshold: 0.1,
    rootMargin: "100px",
  });

  // Handle note deletion
  const handleNoteDelete = useCallback((_noteId: string) => {
    // The hook manages state internally, so we just refresh
    fetchMentions();
  }, [fetchMentions]);

  // Show loading while checking auth
  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-(--bg-primary)">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <PageHeader
          title={<Trans>Mentions</Trans>}
          subtitle={<Trans>Notes that mention you or reply to your posts</Trans>}
          icon={<AtSign className="w-6 h-6" />}
        />

        {/* Mentions List */}
        <div
          ref={timelineContainerRef}
          className="space-y-4"
          role="feed"
          aria-busy={loading}
          aria-label="Mentions timeline"
        >
          {/* Initial Loading State */}
          {loading && mentions.length === 0 && (
            <div role="status" aria-label="Loading mentions">
              <TimelineSkeleton count={3} />
              <span className="sr-only">
                <Trans>Loading mentions...</Trans>
              </span>
            </div>
          )}

          {/* Notes List with Animation */}
          <AnimatedList
            items={mentions}
            keyExtractor={(note) => note.id}
            className="space-y-4"
            renderItem={(note) => (
              <NoteCard note={note} onDelete={() => handleNoteDelete(note.id)} />
            )}
          />

          {/* Loading More Indicator */}
          {loading && mentions.length > 0 && (
            <div className="flex justify-center py-8" role="status" aria-label="Loading more mentions">
              <Loader2 className="w-6 h-6 animate-spin text-(--text-muted)" />
              <span className="sr-only">
                <Trans>Loading more mentions...</Trans>
              </span>
            </div>
          )}

          {/* Load More Trigger */}
          <div ref={sentinelRef} className="h-4" aria-hidden="true" />

          {/* End of Timeline */}
          {!hasMore && mentions.length > 0 && (
            <div
              className="py-8 text-center text-(--text-muted)"
              role="status"
              aria-live="polite"
            >
              <Trans>You've reached the end</Trans>
            </div>
          )}

          {/* Empty State */}
          {!loading && mentions.length === 0 && (
            <div className="bg-(--card-bg) rounded-lg border border-(--border-color) overflow-hidden">
              <div className="flex flex-col items-center justify-center py-12 text-(--text-muted)">
                <AtSign className="w-12 h-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  <Trans>No mentions yet</Trans>
                </p>
                <p className="text-sm mt-1">
                  <Trans>When someone mentions you, it will appear here</Trans>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Scroll to Top Button */}
        <ScrollToTop />
      </div>
    </Layout>
  );
}
