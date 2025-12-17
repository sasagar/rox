"use client";

import React, { useCallback, useRef } from "react";
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

  // Mobile touch handling
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) {
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    }
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;

      const touch = e.changedTouches[0];
      if (!touch) return;

      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Only handle horizontal swipes
      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
        handleMobileSwipe(deltaX > 0 ? "right" : "left");
      }

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
        <div className="hidden lg:block h-[calc(100vh-theme(spacing.12))] overflow-hidden">
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
                    className={`flex-shrink-0 ${getColumnWidthClass(column.width)} snap-start`}
                  >
                    <DeckColumn column={column} />
                  </div>
                ))}

                {/* Add Column Button */}
                {showAddColumn && (
                  <div className="flex-shrink-0 w-16 snap-start flex items-center justify-center">
                    <AddColumnButton />
                  </div>
                )}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        {/* Mobile: Single column with swipe */}
        <div
          className="lg:hidden h-[calc(100vh-theme(spacing.32))] overflow-hidden"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {columns.length > 0 && columns[mobileColumnIndex] && (
            <div className="h-full">
              <DeckColumn column={columns[mobileColumnIndex]} isMobile />
            </div>
          )}

          {/* Mobile Column Indicators */}
          {columns.length > 1 && (
            <div className="fixed bottom-20 left-0 right-0 flex justify-center gap-2 pb-2">
              {columns.map((col, index) => (
                <button
                  key={col.id}
                  onClick={() => setMobileColumnIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === mobileColumnIndex
                      ? "bg-(--accent-color)"
                      : "bg-gray-400 dark:bg-gray-600"
                  }`}
                  aria-label={`Go to column ${index + 1}`}
                />
              ))}
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
