"use client";

import React, { useCallback, useRef, useState, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Trans } from "@lingui/react/macro";
import {
  mobileActiveColumnIndexAtom,
  setMobileActiveColumnAtom,
} from "../../lib/atoms/deck";
import { currentUserAtom } from "../../lib/atoms/auth";
import { useDeckProfiles } from "../../hooks/useDeckProfiles";
import { sidebarCollapsedAtom } from "../../lib/atoms/sidebar";
import { Sidebar } from "../layout/Sidebar";
import { MobileAppBar } from "../layout/MobileAppBar";
import { ComposeModal } from "../note/ComposeModal";
import { useUISettings } from "../../lib/hooks/useUISettings";
import { DeckColumn } from "./DeckColumn";
import { AddColumnButton } from "./AddColumnButton";
import { DeckProfileSwitcher } from "./DeckProfileSwitcher";
import type { DeckColumnWidth } from "../../lib/types/deck";

/**
 * Props for the DeckLayout component
 */
export interface DeckLayoutProps {
  /** Whether to show the add column button */
  showAddColumn?: boolean;
  /** Whether to show the profile switcher */
  showProfileSwitcher?: boolean;
}

/**
 * Get Tailwind width class for column width setting
 */
function getColumnWidthClass(width: DeckColumnWidth): string {
  switch (width) {
    case "narrow":
      return "w-80";
    case "wide":
      return "w-[480px]";
    default:
      return "w-96";
  }
}

/**
 * Main deck layout component
 *
 * Displays multiple columns side-by-side with horizontal scrolling.
 * Supports drag-and-drop reordering and mobile swipe navigation.
 */
export function DeckLayout({
  showAddColumn = true,
  showProfileSwitcher = true,
}: DeckLayoutProps) {
  const currentUser = useAtomValue(currentUserAtom);
  const isCollapsed = useAtomValue(sidebarCollapsedAtom);
  const { activeProfile, updateActiveColumns } = useDeckProfiles();
  const columns = activeProfile?.columns ?? [];
  const [mobileColumnIndex, setMobileColumnIndex] = useAtom(
    mobileActiveColumnIndexAtom
  );
  const setMobileColumn = useSetAtom(setMobileActiveColumnAtom);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Apply UI settings (CSS variables, theme, custom CSS)
  useUISettings();

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag end for column reordering
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = columns.findIndex((col) => col.id === active.id);
        const newIndex = columns.findIndex((col) => col.id === over.id);

        // Reorder columns array
        const newColumns = [...columns];
        const [removed] = newColumns.splice(oldIndex, 1);
        if (removed) {
          newColumns.splice(newIndex, 0, removed);
          // Sync to server (optimistic update handled in hook)
          updateActiveColumns(newColumns);
        }
      }
    },
    [columns, updateActiveColumns]
  );

  // Handle mobile swipe
  const handleMobileSwipe = useCallback(
    (direction: "left" | "right") => {
      if (direction === "left" && mobileColumnIndex < columns.length - 1) {
        setMobileColumn(mobileColumnIndex + 1);
      } else if (direction === "right" && mobileColumnIndex > 0) {
        setMobileColumn(mobileColumnIndex - 1);
      }
    },
    [mobileColumnIndex, columns.length, setMobileColumn]
  );

  // Mobile touch handling with visual feedback
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Reset swipe offset when column index changes
  useEffect(() => {
    setSwipeOffset(0);
  }, [mobileColumnIndex]);

  // Ensure mobile index stays within bounds when columns change
  useEffect(() => {
    if (columns.length > 0 && mobileColumnIndex >= columns.length) {
      setMobileColumnIndex(columns.length - 1);
    }
  }, [columns.length, mobileColumnIndex, setMobileColumnIndex]);

  // Reset scroll position to start when profile changes or on initial load
  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft = 0;
    }
    // Also reset mobile column index to first column
    setMobileColumnIndex(0);
  }, [activeProfile?.id, setMobileColumnIndex]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      setIsTransitioning(false);
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.touches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Only handle horizontal swipes (with some tolerance)
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        // Limit swipe offset at edges
        const canSwipeLeft = mobileColumnIndex < columns.length - 1;
        const canSwipeRight = mobileColumnIndex > 0;

        let offset = deltaX;
        if (deltaX < 0 && !canSwipeLeft) {
          offset = deltaX * 0.2; // Resistance at edge
        } else if (deltaX > 0 && !canSwipeRight) {
          offset = deltaX * 0.2; // Resistance at edge
        }

        setSwipeOffset(offset);
      }
    },
    [mobileColumnIndex, columns.length]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Only handle horizontal swipes
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        setIsTransitioning(true);
        handleMobileSwipe(deltaX > 0 ? "right" : "left");
      }

      // Reset offset with animation
      setSwipeOffset(0);
      touchStartRef.current = null;
    },
    [handleMobileSwipe]
  );

  // Sidebar margin for desktop
  const sidebarMarginClass = currentUser
    ? isCollapsed
      ? "lg:ml-16"
      : "lg:ml-64"
    : "";

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <p className="text-(--text-muted)">
          <Trans>Please log in to use the deck.</Trans>
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 transition-colors overflow-hidden">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Deck Area */}
      <main
        className={`min-h-screen transition-all duration-300 ${sidebarMarginClass} pt-mobile-header lg:pt-0`}
      >
        {/* Deck Header - Profile Switcher */}
        {showProfileSwitcher && (
          <div className="sticky top-0 z-20 bg-gray-100 dark:bg-gray-950 border-b border-(--border-color) px-4 py-2 hidden lg:block">
            <DeckProfileSwitcher />
          </div>
        )}

        {/* Desktop: Horizontal scrolling columns */}
        <div className="hidden lg:block h-[calc(100vh-12*var(--spacing))] overflow-hidden">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={columns.map((col) => col.id)}
              strategy={horizontalListSortingStrategy}
            >
              <div
                ref={scrollContainerRef}
                className="flex h-full overflow-x-auto overflow-y-hidden snap-x snap-mandatory scroll-smooth gap-1 p-2"
                style={{ scrollbarWidth: "thin" }}
              >
                {columns.map((column) => (
                  <div
                    key={column.id}
                    className={`shrink-0 ${getColumnWidthClass(column.width)} snap-start`}
                  >
                    <DeckColumn column={column} />
                  </div>
                ))}

                {/* Add Column Button */}
                {showAddColumn && (
                  <div className="shrink-0 w-16 snap-start flex items-center justify-center">
                    <AddColumnButton />
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Mobile: Single column with swipe */}
        {/* Height: 100vh - header (4rem + safe-area) - AppBar (3.5rem) - safe-area-bottom */}
        <div
          className="lg:hidden overflow-hidden pb-14"
          style={{
            height: "calc(100vh - 4rem - env(safe-area-inset-top, 0px) - 3.5rem - env(safe-area-inset-bottom, 0px))",
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {columns.length > 0 && columns[mobileColumnIndex] ? (
            <div
              className={`h-full ${isTransitioning ? "transition-transform duration-200 ease-out" : ""}`}
              style={{ transform: `translateX(${swipeOffset}px)` }}
            >
              <DeckColumn column={columns[mobileColumnIndex]} isMobile />
            </div>
          ) : (
            /* Empty state when no columns */
            <div className="h-full flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 p-4">
              <div className="text-4xl mb-4">📊</div>
              <p className="text-center mb-4">
                <Trans>No columns yet. Add your first column to get started.</Trans>
              </p>
              <AddColumnButton />
            </div>
          )}

          {/* Mobile Column Indicators - positioned above AppBar (h-14 = 3.5rem) */}
          {columns.length > 1 && (
            <div
              className="fixed left-0 right-0 flex justify-center gap-2 pb-2 z-10"
              style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px) + 0.5rem)" }}
            >
              {columns.map((col, index) => (
                <button
                  key={col.id}
                  onClick={() => setMobileColumnIndex(index)}
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-200 ${
                    index === mobileColumnIndex
                      ? "bg-(--accent-color) scale-110"
                      : "bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-500"
                  }`}
                  aria-label={`Go to column ${index + 1}`}
                />
              ))}
            </div>
          )}

          {/* Swipe hint for first-time users - positioned above indicators */}
          {columns.length > 1 && mobileColumnIndex === 0 && (
            <div
              className="fixed left-0 right-0 flex justify-center pointer-events-none"
              style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px) + 2rem)" }}
            >
              <div className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <span>←</span>
                <Trans>Swipe to navigate</Trans>
                <span>→</span>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileAppBar />

      {/* Compose Modal */}
      <ComposeModal />
    </div>
  );
}
