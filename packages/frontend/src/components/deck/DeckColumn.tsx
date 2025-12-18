"use client";

import { useCallback, useState, useMemo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  GripVertical,
  X,
  Settings,
  LayoutGrid,
  Bell,
  AtSign,
  ListIcon,
  Home,
  Globe,
  Users,
  Radio,
} from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "../ui/Button";
import { useDeckProfiles } from "../../hooks/useDeckProfiles";
import type { DeckColumn as DeckColumnType, DeckColumnWidth } from "../../lib/types/deck";

// Column content components (to be implemented)
import { TimelineColumnContent } from "./columns/TimelineColumn";
import { NotificationsColumnContent } from "./columns/NotificationsColumn";
import { MentionsColumnContent } from "./columns/MentionsColumn";
import { ListColumnContent } from "./columns/ListColumn";

/**
 * Props for DeckColumn component
 */
export interface DeckColumnProps {
  column: DeckColumnType;
  /** Whether rendering in mobile mode (full width, no drag) */
  isMobile?: boolean;
}

/**
 * Get icon for column type
 */
function getColumnIcon(column: DeckColumnType): React.ReactNode {
  const iconClass = "w-4 h-4";

  switch (column.config.type) {
    case "timeline":
      switch (column.config.timelineType) {
        case "home":
          return <Home className={iconClass} />;
        case "local":
          return <Users className={iconClass} />;
        case "social":
          return <Radio className={iconClass} />;
        case "global":
          return <Globe className={iconClass} />;
        default:
          return <LayoutGrid className={iconClass} />;
      }
    case "notifications":
      return <Bell className={iconClass} />;
    case "mentions":
      return <AtSign className={iconClass} />;
    case "list":
      return <ListIcon className={iconClass} />;
    default:
      return <LayoutGrid className={iconClass} />;
  }
}

/**
 * Render the content component based on column type
 */
function renderColumnContent(column: DeckColumnType) {
  switch (column.config.type) {
    case "timeline":
      return (
        <TimelineColumnContent
          columnId={column.id}
          timelineType={column.config.timelineType}
        />
      );
    case "notifications":
      return <NotificationsColumnContent columnId={column.id} />;
    case "mentions":
      return <MentionsColumnContent columnId={column.id} />;
    case "list":
      return (
        <ListColumnContent
          columnId={column.id}
          listId={column.config.listId}
        />
      );
    default:
      return (
        <div className="p-4 text-center text-gray-500">
          <Trans>Unknown column type</Trans>
        </div>
      );
  }
}

/**
 * Width option type
 */
interface WidthOption {
  value: DeckColumnWidth;
  label: string;
}

/**
 * A single column in the deck
 *
 * Supports drag-and-drop reordering, width adjustment, and removal.
 */
export function DeckColumn({ column, isMobile = false }: DeckColumnProps) {
  const { t } = useLingui();
  const { activeProfile, updateActiveColumns } = useDeckProfiles();
  const columns = activeProfile?.columns ?? [];
  const [showSettings, setShowSettings] = useState(false);

  // Translated width options
  const widthOptions: WidthOption[] = useMemo(() => [
    { value: "narrow", label: t`Narrow` },
    { value: "normal", label: t`Normal` },
    { value: "wide", label: t`Wide` },
  ], [t]);

  // Get translated column title
  const columnTitle = useMemo(() => {
    // For list columns, use the list name directly
    if (column.config.type === "list" && column.config.listName) {
      return column.config.listName;
    }
    // For timeline columns, translate based on timeline type
    if (column.config.type === "timeline") {
      switch (column.config.timelineType) {
        case "home": return t`Home`;
        case "local": return t`Local`;
        case "social": return t`Social`;
        case "global": return t`Global`;
        default: return t`Timeline`;
      }
    }
    // For other types, translate
    switch (column.config.type) {
      case "notifications": return t`Notifications`;
      case "mentions": return t`Mentions`;
      case "list": return t`List`;
      default: return t`Column`;
    }
  }, [column.config, t]);

  // Sortable setup for drag-and-drop
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: column.id,
    disabled: isMobile,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleRemove = useCallback(() => {
    const newColumns = columns.filter((c) => c.id !== column.id);
    updateActiveColumns(newColumns);
  }, [column.id, columns, updateActiveColumns]);

  const handleWidthChange = useCallback(
    (width: DeckColumnWidth) => {
      const newColumns = columns.map((c) =>
        c.id === column.id ? { ...c, width } : c
      );
      updateActiveColumns(newColumns);
      setShowSettings(false);
    },
    [column.id, columns, updateActiveColumns]
  );

  return (
    <div
      ref={setNodeRef}
      style={isMobile ? undefined : style}
      className={`
        flex flex-col h-full
        bg-white dark:bg-gray-800
        ${isMobile ? "" : "rounded-lg shadow-sm border border-gray-200 dark:border-gray-700"}
        overflow-hidden
      `}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
        <div className="flex items-center gap-2">
          {/* Drag Handle (desktop only) */}
          {!isMobile && (
            <button
              {...attributes}
              {...listeners}
              className="p-1 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 touch-none"
              aria-label="Drag to reorder"
            >
              <GripVertical className="w-4 h-4" />
            </button>
          )}

          {/* Column Icon & Title */}
          <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
            {getColumnIcon(column)}
            <span className="font-medium text-sm">{columnTitle}</span>
          </div>
        </div>

        {/* Column Actions */}
        <div className="flex items-center gap-1">
          {/* Settings Toggle */}
          <Button
            variant="ghost"
            onPress={() => setShowSettings(!showSettings)}
            className="p-1.5 rounded"
            aria-label="Column settings"
          >
            <Settings className="w-4 h-4" />
          </Button>

          {/* Remove Column */}
          <Button
            variant="ghost"
            onPress={handleRemove}
            className="p-1.5 rounded text-gray-400 hover:text-red-500"
            aria-label="Remove column"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 dark:text-gray-400">
              <Trans>Width:</Trans>
            </span>
            <div className="flex gap-1">
              {widthOptions.map((option) => (
                <button
                  type="button"
                  key={option.value}
                  onClick={() => handleWidthChange(option.value)}
                  className={`px-2 py-1 text-xs rounded transition-colors ${
                    column.width === option.value
                      ? "bg-primary-500 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Column Content */}
      <div className="flex-1 overflow-y-auto">
        {renderColumnContent(column)}
      </div>
    </div>
  );
}
