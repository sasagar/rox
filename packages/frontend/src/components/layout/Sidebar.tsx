"use client";

import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { Home, User, Settings, Shield, Bell, Search } from "lucide-react";
import { currentUserAtom } from "../../lib/atoms/auth";
import { Avatar } from "../ui/Avatar";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { DarkModeToggle } from "../ui/DarkModeToggle";
import { NotificationBell } from "../notification/NotificationBell";
import { useInstanceInfo } from "../../hooks/useInstanceInfo";

/**
 * Sidebar navigation component
 * Misskey-style sidebar for main navigation
 */
export function Sidebar() {
  const [currentUser] = useAtom(currentUserAtom);
  const { instanceInfo } = useInstanceInfo();

  if (!currentUser) {
    return null;
  }

  const userInitials = currentUser.name
    ? currentUser.name
        .split(" ")
        .map((n: string) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : currentUser.username.slice(0, 2).toUpperCase();

  const navItems = [
    {
      icon: <Home className="w-6 h-6" />,
      label: <Trans>Home</Trans>,
      href: "/timeline",
      key: "home",
    },
    {
      icon: <Search className="w-6 h-6" />,
      label: <Trans>Search</Trans>,
      href: "/search",
      key: "search",
    },
    {
      icon: <Bell className="w-6 h-6" />,
      label: <Trans>Notifications</Trans>,
      href: "/notifications",
      key: "notifications",
    },
    {
      icon: <User className="w-6 h-6" />,
      label: <Trans>Profile</Trans>,
      href: `/${currentUser.username}`,
      key: "profile",
    },
    {
      icon: <Settings className="w-6 h-6" />,
      label: <Trans>Settings</Trans>,
      href: "/settings",
      key: "settings",
    },
  ];

  // Add admin link for admin users
  if (currentUser.isAdmin) {
    navItems.push({
      icon: <Shield className="w-6 h-6" />,
      label: <Trans>Admin</Trans>,
      href: "/admin/settings",
      key: "admin",
    });
  }

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-(--card-bg) border-r border-(--border-color) flex flex-col">
      {/* Logo / Brand */}
      <div className="p-6 border-b border-(--border-color)">
        <a href="/" className="flex items-center gap-3">
          {instanceInfo?.iconUrl ? (
            <img
              src={instanceInfo.iconUrl}
              alt={instanceInfo.name || "Logo"}
              className="w-8 h-8 rounded-lg object-cover"
            />
          ) : null}
          <span className="text-2xl font-bold text-primary-600">
            {instanceInfo?.name || "Rox"}
          </span>
        </a>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {navItems.map((item) => (
          <a
            key={item.key}
            href={item.href}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-(--text-secondary) hover:bg-(--bg-tertiary) transition-colors"
          >
            <span className="text-(--text-muted)">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </a>
        ))}
      </nav>

      {/* Notifications & Language & Theme */}
      <div className="p-4 border-t border-(--border-color) flex items-center justify-between">
        <NotificationBell />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <DarkModeToggle />
        </div>
      </div>

      {/* User Profile at Bottom */}
      <div className="p-4 border-t border-(--border-color)">
        <a
          href={`/${currentUser.username}`}
          className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-(--bg-tertiary) transition-colors"
        >
          <Avatar
            src={currentUser.avatarUrl}
            alt={currentUser.name || currentUser.username}
            fallback={userInitials}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-(--text-primary) truncate">
              {(currentUser as any).displayName || currentUser.username}
            </p>
            <p className="text-xs text-(--text-muted) truncate">@{currentUser.username}</p>
          </div>
        </a>
      </div>
    </aside>
  );
}
