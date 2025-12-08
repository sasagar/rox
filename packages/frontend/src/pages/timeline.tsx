"use client";

import { Trans } from "@lingui/react/macro";
import { useAtom } from "jotai";
import { useEffect, useState, useCallback, useRef } from "react";
import { Timeline } from "../components/timeline/Timeline";
import { NoteComposer } from "../components/note/NoteComposer";
import { Layout } from "../components/layout/Layout";
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
  const hasRestoredTimelineType = useRef(false);

  // Save timeline type to localStorage when it changes
  const handleTimelineTypeChange = useCallback((type: TimelineType) => {
    setTimelineType(type);
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

  const handleNoteCreated = async () => {
    // Refresh timeline by fetching latest notes
    try {
      const newNotes = await apiClient.get<any[]>("/api/notes/local-timeline?limit=20");
      setTimelineNotes(newNotes);
    } catch (error) {
      console.error("Failed to refresh timeline:", error);
      // Fallback: just reload the page
      window.location.reload();
    }
  };

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
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-4xl font-bold text-gray-900 dark:text-gray-100">
          <Trans>Timeline</Trans>
        </h1>
        <p className="mt-1 sm:mt-2 text-sm sm:text-base text-gray-600 dark:text-gray-400">
          <Trans>Recent posts from your community</Trans>
        </p>
      </div>

      {/* Timeline Type Tabs */}
      <div
        className="mb-4 sm:mb-6 border-b border-gray-200 dark:border-gray-700"
        role="tablist"
        aria-label="Timeline types"
      >
        <div className="flex gap-3 sm:gap-6">
          <button
            onClick={() => handleTimelineTypeChange("local")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              timelineType === "local"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500"
            }`}
            role="tab"
            aria-selected={timelineType === "local"}
            aria-controls="timeline-content"
            id="tab-local"
          >
            <Trans>Local</Trans>
          </button>
          <button
            onClick={() => handleTimelineTypeChange("social")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              timelineType === "social"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500"
            }`}
            role="tab"
            aria-selected={timelineType === "social"}
            aria-controls="timeline-content"
            id="tab-social"
          >
            <Trans>Social</Trans>
          </button>
          <button
            onClick={() => handleTimelineTypeChange("global")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              timelineType === "global"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500"
            }`}
            role="tab"
            aria-selected={timelineType === "global"}
            aria-controls="timeline-content"
            id="tab-global"
          >
            <Trans>Global</Trans>
          </button>
          <button
            onClick={() => handleTimelineTypeChange("home")}
            className={`pb-3 px-1 border-b-2 font-medium text-sm transition-colors ${
              timelineType === "home"
                ? "border-primary-500 text-primary-600 dark:text-primary-400"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-500"
            }`}
            role="tab"
            aria-selected={timelineType === "home"}
            aria-controls="timeline-content"
            id="tab-home"
          >
            <Trans>Home</Trans>
          </button>
        </div>
      </div>

      {/* Note Composer */}
      <NoteComposer onNoteCreated={handleNoteCreated} />

      {/* Timeline */}
      <div id="timeline-content" role="tabpanel" aria-labelledby={`tab-${timelineType}`}>
        <Timeline key={timelineType} type={timelineType} />
      </div>
    </Layout>
  );
}
