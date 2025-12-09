"use client";

/**
 * Admin Navigation Component
 *
 * Provides navigation between admin pages.
 */

import { Settings, Users, UserCog, Ticket, Shield, AlertTriangle, Smile, HardDrive, Globe, Activity, MessageCircle } from "lucide-react";

/**
 * Admin navigation items
 */
const ADMIN_NAV_ITEMS = [
  { href: "/admin/settings", icon: Settings, label: "Settings" },
  { href: "/admin/users", icon: UserCog, label: "Users" },
  { href: "/admin/roles", icon: Users, label: "Roles" },
  { href: "/admin/emojis", icon: Smile, label: "Emojis" },
  { href: "/admin/storage", icon: HardDrive, label: "Storage" },
  { href: "/admin/federation", icon: Globe, label: "Federation" },
  { href: "/admin/queue", icon: Activity, label: "Queue" },
  { href: "/admin/invitations", icon: Ticket, label: "Invitations" },
  { href: "/admin/blocks", icon: Shield, label: "Blocks" },
  { href: "/admin/reports", icon: AlertTriangle, label: "Reports" },
  { href: "/admin/contacts", icon: MessageCircle, label: "Contacts" },
];

interface AdminNavProps {
  currentPath: string;
}

export function AdminNav({ currentPath }: AdminNavProps) {
  return (
    <div className="flex gap-2 mb-6 flex-wrap">
      {ADMIN_NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === currentPath;
        return (
          <a
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary-600 text-white"
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
