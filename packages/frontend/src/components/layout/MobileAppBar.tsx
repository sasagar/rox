"use client";

/**
 * Mobile App Bar Component
 *
 * Fixed bottom navigation bar for mobile devices.
 * Provides quick access to main navigation items.
 *
 * @module components/layout/MobileAppBar
 */

import { useAtom } from "jotai";
import { Home, Search, Bell, User, PenSquare } from "lucide-react";
import { currentUserAtom } from "../../lib/atoms/auth";
import { SpaLink } from "../ui/SpaLink";

/**
 * Mobile App Bar Component
 *
 * Shows a fixed bottom navigation bar on mobile devices with icons for:
 * - Home (Timeline)
 * - Search
 * - Post (New Note)
 * - Notifications
 * - Profile
 *
 * Only visible on screens smaller than lg breakpoint (1024px).
 * Hidden when user is not logged in.
 */
export function MobileAppBar() {
  const [currentUser] = useAtom(currentUserAtom);

  if (!currentUser) {
    return null;
  }

  const navItems = [
    {
      icon: <Home className="w-6 h-6" />,
      href: "/timeline",
      key: "home",
      label: "Home",
    },
    {
      icon: <Search className="w-6 h-6" />,
      href: "/search",
      key: "search",
      label: "Search",
    },
    {
      icon: <PenSquare className="w-6 h-6" />,
      href: "/timeline?compose=true",
      key: "post",
      label: "Post",
      highlight: true,
    },
    {
      icon: <Bell className="w-6 h-6" />,
      href: "/notifications",
      key: "notifications",
      label: "Notifications",
    },
    {
      icon: <User className="w-6 h-6" />,
      href: `/${currentUser.username}`,
      key: "profile",
      label: "Profile",
    },
  ];

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-(--card-bg) border-t border-(--border-color)"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Main navigation content - icons should be centered in this area */}
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) => (
          <SpaLink
            key={item.key}
            to={item.href}
            className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors ${
              item.highlight
                ? "text-primary-600 dark:text-primary-400"
                : "text-(--text-muted) hover:text-(--text-secondary)"
            }`}
            aria-label={item.label}
          >
            <span className={item.highlight ? "p-1.5 rounded-full bg-primary-100 dark:bg-primary-900/30" : ""}>
              {item.icon}
            </span>
          </SpaLink>
        ))}
      </div>
      {/* Safe area spacer - adds padding below content for notched devices */}
      <div className="safe-area-inset-bottom" />
    </nav>
  );
}
