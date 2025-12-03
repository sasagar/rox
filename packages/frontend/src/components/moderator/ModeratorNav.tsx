"use client";

/**
 * Moderator Navigation Component
 *
 * Provides navigation between moderator pages.
 */

import { ClipboardList, FileText, Users, History, Globe } from "lucide-react";

/**
 * Moderator navigation items
 */
const MODERATOR_NAV_ITEMS = [
  { href: "/mod/reports", icon: ClipboardList, label: "Reports" },
  { href: "/mod/notes", icon: FileText, label: "Notes" },
  { href: "/mod/users", icon: Users, label: "Users" },
  { href: "/mod/instances", icon: Globe, label: "Instances" },
  { href: "/mod/audit-logs", icon: History, label: "Audit Logs" },
];

interface ModeratorNavProps {
  currentPath: string;
}

export function ModeratorNav({ currentPath }: ModeratorNavProps) {
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {MODERATOR_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === currentPath;
        return (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-orange-600 text-white"
                : "bg-(--bg-tertiary) text-(--text-secondary) hover:bg-(--bg-primary) hover:text-(--text-primary)"
            }`}
          >
            <Icon className="w-4 h-4" />
            {item.label}
          </a>
        );
      })}
    </div>
  );
}
