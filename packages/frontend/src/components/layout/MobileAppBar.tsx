"use client";

/**
 * Mobile App Bar Component
 *
 * Fixed bottom navigation bar for mobile devices.
 * Provides quick access to main navigation items.
 *
 * @module components/layout/MobileAppBar
 */

import { useAtomValue, useSetAtom } from "jotai";
import { Home, Search, Bell, User, PenSquare } from "lucide-react";
import { currentUserAtom } from "../../lib/atoms/auth";
import { openComposeModalAtom } from "../../lib/atoms/compose";
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
  const currentUser = useAtomValue(currentUserAtom);
  const openComposeModal = useSetAtom(openComposeModalAtom);

  if (!currentUser) {
    return null;
  }

  // Use fixed pixel sizes for icons to prevent scaling with UI font size settings
  // (rem-based sizes like w-6 h-6 would scale with --rox-font-size)
  const iconStyle = { width: "24px", height: "24px" };

  const navItems = [
    {
      icon: <Home style={iconStyle} />,
      href: "/timeline",
      key: "home",
      label: "Home",
    },
    {
      icon: <Search style={iconStyle} />,
      href: "/search",
      key: "search",
      label: "Search",
    },
    {
      icon: <PenSquare style={iconStyle} />,
      key: "post",
      label: "Post",
      highlight: true,
      isButton: true,
    },
    {
      icon: <Bell style={iconStyle} />,
      href: "/notifications",
      key: "notifications",
      label: "Notifications",
    },
    {
      icon: <User style={iconStyle} />,
      href: `/${currentUser.username}`,
      key: "profile",
      label: "Profile",
    },
  ];

  const handlePostClick = () => {
    openComposeModal();
  };

  return (
    <nav
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-(--card-bg) border-t border-(--border-color)"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Main navigation content - icons should be centered in this area */}
      <div className="flex items-center justify-around h-14 px-2">
        {navItems.map((item) =>
          item.isButton ? (
            <button
              key={item.key}
              onClick={handlePostClick}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors text-primary-600 dark:text-primary-400"
              aria-label={item.label}
            >
              <span className="p-1.5 rounded-full bg-primary-100 dark:bg-primary-900/30">
                {item.icon}
              </span>
            </button>
          ) : (
            <SpaLink
              key={item.key}
              to={item.href!}
              className="flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors text-(--text-muted) hover:text-(--text-secondary)"
              aria-label={item.label}
            >
              {item.icon}
            </SpaLink>
          )
        )}
      </div>
      {/* Safe area spacer - adds padding below content for notched devices */}
      <div className="safe-area-inset-bottom" />
    </nav>
  );
}
