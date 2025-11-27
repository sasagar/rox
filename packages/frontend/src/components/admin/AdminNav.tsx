'use client';

/**
 * Admin Navigation Component
 *
 * Provides navigation between admin pages.
 */

import { Settings, Users, Ticket, Shield, AlertTriangle, Smile } from 'lucide-react';

/**
 * Admin navigation items
 */
const ADMIN_NAV_ITEMS = [
  { href: '/admin/settings', icon: Settings, label: 'Settings' },
  { href: '/admin/roles', icon: Users, label: 'Roles' },
  { href: '/admin/emojis', icon: Smile, label: 'Emojis' },
  { href: '/admin/invitations', icon: Ticket, label: 'Invitations' },
  { href: '/admin/blocks', icon: Shield, label: 'Blocks' },
  { href: '/admin/reports', icon: AlertTriangle, label: 'Reports' },
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
                ? 'bg-primary-600 text-white'
                : 'bg-(--bg-tertiary) text-(--text-secondary) hover:bg-(--bg-primary) hover:text-(--text-primary)'
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
