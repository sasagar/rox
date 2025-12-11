"use client";

import { Trans } from "@lingui/react/macro";
import { useAtom } from "jotai";
import { useEffect, useState, useCallback, useRef } from "react";
import { Timeline } from "../components/timeline/Timeline";
import { NoteComposer } from "../components/note/NoteComposer";
import { Layout } from "../components/layout/Layout";
import { PageHeader } from "../components/ui/PageHeader";
import { currentUserAtom, tokenAtom } from "../lib/atoms/auth";
import { timelineNotesAtom } from "../lib/atoms/timeline";
import { apiClient } from "../lib/api/client";

/**
 * Timeline page component
 * Authenticated users only - shows timeline with note composer
 */
type TimelineType = "local" | "social" | "global" | "home";

const TIMELINE_TYPE_STORAGE_KEY = "rox:timelineType";

export default function TimelinePage() {
  const [currentUser, setCurrentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, setTimelineNotes] = useAtom(timelineNotesAtom);
  // Start with default value to avoid hydration mismatch
  // localStorage value is loaded in useEffect after hydration
  const [timelineType, setTimelineType] = useState<TimelineType>("local");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const hasRestoredTimelineType = useRef(false);

  // Save timeline type to localStorage when it changes
  const handleTimelineTypeChange = useCallback((type: string) => {
    setTimelineType(type as TimelineType);
    localStorage.setItem(TIMELINE_TYPE_STORAGE_KEY, type);
  }, []);

  // Restore timeline type from localStorage after hydration
  useEffect(() => {
    if (hasRestoredTimelineType.current) return;
    hasRestoredTimelineType.current = true;

    const saved = localStorage.getItem(TIMELINE_TYPE_STORAGE_KEY);
    if (saved === "local" || saved === "social" || saved === "global" || saved === "home") {
      setTimelineType(saved);
    }
  }, []);

  // Restore user session on mount
  useEffect(() => {
    const restoreSession = async () => {
      // No token at all, redirect to login
      if (!token) {
        window.location.href = "/login";
        return;
      }

      // Token exists but no user data, try to restore session
      if (!currentUser) {
        try {
          apiClient.setToken(token);
          const response = await apiClient.get<{ user: any }>("/api/auth/session");
          setCurrentUser(response.user);
          setIsLoading(false);
        } catch (error) {
          console.error("Failed to restore session:", error);
          // Token is invalid, redirect to login
          window.location.href = "/login";
          return;
        }
      } else {
        // Already have user data, just stop loading
        setIsLoading(false);
      }
    };
    restoreSession();
  }, [token, currentUser, setCurrentUser]);

  const refreshTimeline = useCallback(async () => {
    const endpoint =
      timelineType === "home"
        ? "/api/notes/timeline"
        : timelineType === "social"
          ? "/api/notes/social-timeline"
          : timelineType === "global"
            ? "/api/notes/global-timeline"
            : "/api/notes/local-timeline";

    try {
      const newNotes = await apiClient.get<any[]>(`${endpoint}?limit=20`);
      setTimelineNotes(newNotes);
    } catch (error) {
      console.error("Failed to refresh timeline:", error);
    }
  }, [timelineType, setTimelineNotes]);

  const handleNoteCreated = useCallback(async () => {
    await refreshTimeline();
  }, [refreshTimeline]);

  const handleReload = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refreshTimeline();
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshTimeline]);

  // Show loading while checking auth
  if (isLoading || !currentUser) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <Layout>
      <PageHeader
        title={<Trans>Timeline</Trans>}
        subtitle={<Trans>Recent posts from your community</Trans>}
        tabs={[
          { key: "local", label: <Trans>Local</Trans> },
          { key: "social", label: <Trans>Social</Trans> },
          { key: "global", label: <Trans>Global</Trans> },
          { key: "home", label: <Trans>Home</Trans> },
        ]}
        activeTab={timelineType}
        onTabChange={handleTimelineTypeChange}
        showReload
        onReload={handleReload}
        isReloading={isRefreshing}
      />

      {/* Note Composer */}
      <NoteComposer onNoteCreated={handleNoteCreated} />

      {/* Timeline */}
      <div id="timeline-content" role="tabpanel" aria-labelledby={`tab-${timelineType}`}>
        <Timeline key={timelineType} type={timelineType} />
      </div>
    </Layout>
  );
}
