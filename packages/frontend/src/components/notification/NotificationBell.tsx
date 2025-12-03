"use client";

/**
 * Notification bell icon with badge
 *
 * Shows unread notification count and opens notification panel
 */

import { useState, useRef, useEffect } from "react";
import { Trans } from "@lingui/react/macro";
import { Bell, X } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { NotificationList } from "./NotificationList";

export function NotificationBell() {
  const { unreadCount } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        isOpen &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Close panel on escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isOpen) {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <div className="relative">
      {/* Bell button */}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative flex items-center justify-center w-10 h-10 rounded-lg text-(--text-muted) hover:bg-(--bg-tertiary) hover:text-(--text-primary) transition-colors"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <Bell className="w-6 h-6" />

        {/* Unread badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Notification panel */}
      {isOpen && (
        <div
          ref={panelRef}
          className="absolute left-full bottom-0 ml-2 w-96 max-h-[80vh] bg-(--card-bg) border border-(--border-color) rounded-lg shadow-lg overflow-hidden z-50"
          role="dialog"
          aria-label="Notifications"
        >
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-(--border-color)">
            <h2 className="text-lg font-semibold text-(--text-primary)">
              <Trans>Notifications</Trans>
            </h2>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-(--text-muted) hover:bg-(--bg-tertiary) hover:text-(--text-primary) transition-colors"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto max-h-[calc(80vh-60px)]">
            <NotificationList />
          </div>

          {/* View all link */}
          <div className="border-t border-(--border-color) p-3">
            <a
              href="/notifications"
              className="block text-center text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Trans>View all notifications</Trans>
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
