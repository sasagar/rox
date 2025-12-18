"use client";

import { useState, useEffect } from "react";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import {
  Home,
  User,
  Settings,
  Shield,
  Bell,
  Search,
  Menu,
  X,
  PanelLeftClose,
  PanelLeft,
  LogOut,
  PenSquare,
  AtSign,
  Mail,
  List,
} from "lucide-react";
import { currentUserAtom, logoutAtom } from "../../lib/atoms/auth";
import { openComposeModalAtom } from "../../lib/atoms/compose";
import { sidebarCollapsedAtom } from "../../lib/atoms/sidebar";
import { themeAtom } from "../../lib/atoms/uiSettings";
import { Avatar } from "../ui/Avatar";
import { SpaLink } from "../ui/SpaLink";
import { LanguageSwitcher } from "../LanguageSwitcher";
import { DarkModeToggle } from "../ui/DarkModeToggle";
import { NotificationBell } from "../notification/NotificationBell";
import { useInstanceInfo } from "../../hooks/useInstanceInfo";

/**
 * Sidebar navigation component
 * Misskey-style sidebar for main navigation
 * Responsive: Desktop shows fixed sidebar, mobile shows hamburger menu
 */
export function Sidebar() {
  const currentUser = useAtomValue(currentUserAtom);
  const logout = useSetAtom(logoutAtom);
  const openComposeModal = useSetAtom(openComposeModalAtom);
  const { instanceInfo } = useInstanceInfo();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useAtom(sidebarCollapsedAtom);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const theme = useAtomValue(themeAtom);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Determine effective dark mode state
  useEffect(() => {
    const updateDarkMode = () => {
      if (theme === "dark") {
        setIsDarkMode(true);
      } else if (theme === "light") {
        setIsDarkMode(false);
      } else {
        // System preference
        setIsDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
      }
    };

    updateDarkMode();

    // Listen for system preference changes when theme is 'system'
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      mediaQuery.addEventListener("change", updateDarkMode);
      return () => mediaQuery.removeEventListener("change", updateDarkMode);
    }
    return undefined;
  }, [theme]);

  // Toggle collapsed state
  const toggleCollapsed = () => {
    setIsCollapsed(!isCollapsed);
  };

  // Close mobile menu on route change or resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

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
      icon: <AtSign className="w-6 h-6" />,
      label: <Trans>Mentions</Trans>,
      href: "/mentions",
      key: "mentions",
    },
    {
      icon: <Mail className="w-6 h-6" />,
      label: <Trans>Messages</Trans>,
      href: "/messages",
      key: "messages",
    },
    {
      icon: <List className="w-6 h-6" />,
      label: <Trans>Lists</Trans>,
      href: "/lists",
      key: "lists",
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

  // Select appropriate icon based on dark mode state
  const effectiveIconUrl =
    isDarkMode && instanceInfo?.darkIconUrl ? instanceInfo.darkIconUrl : instanceInfo?.iconUrl;

  const handleNavClick = () => {
    setIsMobileMenuOpen(false);
  };

  const handlePostClick = () => {
    setIsMobileMenuOpen(false);
    openComposeModal();
  };

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    setIsMobileMenuOpen(false);
    await logout();
  };

  // Mobile sidebar content (always expanded)
  const MobileSidebarContent = () => (
    <>
      {/* Logo / Brand */}
      <div className="p-4 border-b border-(--border-color)">
        <SpaLink to="/timeline" className="flex items-center gap-3" onClick={handleNavClick}>
          <SpaLink to="/timeline" className="flex items-center gap-3" onClick={handleNavClick}>
            {effectiveIconUrl ? (
              <img
                src={effectiveIconUrl}
                alt={instanceInfo?.name || "Logo"}
                className="w-8 h-8 rounded-lg object-cover"
              />
            ) : null}
            <span className="text-xl font-bold text-primary-600">
              {instanceInfo?.name || "Rox"}
            </span>
          </SpaLink>
        </SpaLink>
      </div>

      {/* Post Button */}
      <div className="p-3">
        <button
          type="button"
          onClick={handlePostClick}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors cursor-pointer"
        >
          <PenSquare className="w-5 h-5" />
          <span className="font-medium"><Trans>Post</Trans></span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => (
          <SpaLink
            key={item.key}
            to={item.href}
            onClick={handleNavClick}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-(--text-secondary) hover:bg-(--bg-tertiary) transition-colors"
          >
            <span className="text-(--text-muted)">{item.icon}</span>
            <span className="font-medium">{item.label}</span>
          </SpaLink>
        ))}
      </nav>

      {/* Notifications & Language & Theme */}
      <div className="p-3 border-t border-(--border-color) flex items-center justify-between">
        <NotificationBell />
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <DarkModeToggle />
        </div>
      </div>

      {/* User Profile at Bottom */}
      <div className="p-3 border-t border-(--border-color)">
        <SpaLink
          to={`/${currentUser.username}`}
          onClick={handleNavClick}
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
        </SpaLink>
      </div>

      {/* Logout Button */}
      <div className="p-3 border-t border-(--border-color)">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">
            {isLoggingOut ? <Trans>Logging out...</Trans> : <Trans>Logout</Trans>}
          </span>
        </button>
      </div>

      {/* Version display */}
      {instanceInfo?.software && (
        <div className="px-3 py-2 border-t border-(--border-color)">
          <SpaLink
            to="/settings?tab=advanced"
            onClick={handleNavClick}
            className="text-xs text-(--text-muted) hover:text-(--text-secondary) transition-colors"
            title={`${instanceInfo.software.name} v${instanceInfo.software.version}`}
          >
            v{instanceInfo.software.version}
          </SpaLink>
        </div>
      )}
    </>
  );

  // Desktop sidebar content (supports collapsed mode)
  const DesktopSidebarContent = () => (
    <>
      {/* Logo / Brand with collapse toggle */}
      <div
        className={`p-4 border-b border-(--border-color) flex items-center ${isCollapsed ? "justify-center" : "justify-between"}`}
      >
        <SpaLink to="/timeline" className={`flex items-center ${isCollapsed ? "" : "gap-3"}`}>
          <SpaLink to="/timeline" className={`flex items-center ${isCollapsed ? "" : "gap-3"}`}>
            {/* Use same icon for both collapsed and expanded modes */}
            {isCollapsed ? (
              effectiveIconUrl ? (
                <img
                  src={effectiveIconUrl}
                  alt={instanceInfo?.name || "Logo"}
                  className="w-8 h-8 rounded object-cover"
                />
              ) : (
                <span className="text-xl font-bold text-primary-600">R</span>
              )
            ) : (
              <>
                {effectiveIconUrl ? (
                  <img
                    src={effectiveIconUrl}
                    alt={instanceInfo?.name || "Logo"}
                    className="w-8 h-8 rounded-lg object-cover"
                  />
                ) : null}
                <span className="text-xl font-bold text-primary-600">
                  {instanceInfo?.name || "Rox"}
                </span>
              </>
            )}
          </SpaLink>
        </SpaLink>
        {!isCollapsed && (
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-1.5 rounded-lg text-(--text-muted) hover:bg-(--bg-tertiary) transition-colors cursor-pointer"
            aria-label="Collapse sidebar"
            title="Collapse sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Post Button */}
      <div className={isCollapsed ? "p-2" : "p-4"}>
        <button
          type="button"
          onClick={handlePostClick}
          className={`w-full flex items-center rounded-lg bg-primary-500 hover:bg-primary-600 text-white transition-colors cursor-pointer ${
            isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
          }`}
          title={isCollapsed ? "Post" : undefined}
        >
          <PenSquare className="w-5 h-5" />
          {!isCollapsed && <span className="font-medium"><Trans>Post</Trans></span>}
        </button>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${isCollapsed ? "p-2" : "p-4 pt-0"} space-y-2 overflow-y-auto`}>
        {navItems.map((item) => (
          <SpaLink
            key={item.key}
            to={item.href}
            className={`flex items-center rounded-lg text-(--text-secondary) hover:bg-(--bg-tertiary) transition-colors ${
              isCollapsed ? "justify-center p-3" : "gap-3 px-4 py-3"
            }`}
            title={isCollapsed ? String(item.key) : undefined}
          >
            <span className="text-(--text-muted)">{item.icon}</span>
            {!isCollapsed && <span className="font-medium">{item.label}</span>}
          </SpaLink>
        ))}
      </nav>

      {/* Notifications & Language & Theme */}
      <div className={`border-t border-(--border-color) ${isCollapsed ? "p-2" : "p-4"}`}>
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2">
            <NotificationBell />
            <DarkModeToggle />
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <NotificationBell />
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <DarkModeToggle />
            </div>
          </div>
        )}
      </div>

      {/* User Profile at Bottom */}
      <div className={`border-t border-(--border-color) ${isCollapsed ? "p-2" : "p-4"}`}>
        <SpaLink
          to={`/${currentUser.username}`}
          className={`flex items-center rounded-lg hover:bg-(--bg-tertiary) transition-colors ${
            isCollapsed ? "justify-center p-2" : "gap-3 px-2 py-2"
          }`}
          title={isCollapsed ? currentUser.username : undefined}
        >
          <Avatar
            src={currentUser.avatarUrl}
            alt={currentUser.name || currentUser.username}
            fallback={userInitials}
            size="sm"
          />
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-(--text-primary) truncate">
                {(currentUser as any).displayName || currentUser.username}
              </p>
              <p className="text-xs text-(--text-muted) truncate">@{currentUser.username}</p>
            </div>
          )}
        </SpaLink>
      </div>

      {/* Logout Button */}
      <div className={`border-t border-(--border-color) ${isCollapsed ? "p-2" : "p-4"}`}>
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className={`flex items-center rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50 cursor-pointer ${
            isCollapsed ? "justify-center p-2 w-full" : "gap-3 px-3 py-2 w-full"
          }`}
          title={isCollapsed ? "Logout" : undefined}
        >
          <LogOut className="w-5 h-5" />
          {!isCollapsed && (
            <span className="font-medium">
              {isLoggingOut ? <Trans>Logging out...</Trans> : <Trans>Logout</Trans>}
            </span>
          )}
        </button>
      </div>

      {/* Expand button when collapsed */}
      {isCollapsed && (
        <div className="p-2 border-t border-(--border-color) flex justify-center">
          <button
            type="button"
            onClick={toggleCollapsed}
            className="p-2 rounded-lg text-(--text-muted) hover:bg-(--bg-tertiary) transition-colors cursor-pointer"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Version display */}
      {instanceInfo?.software && (
        <div className={`border-t border-(--border-color) ${isCollapsed ? "p-2 flex justify-center" : "px-4 py-2"}`}>
          <SpaLink
            to="/settings?tab=advanced"
            className="text-xs text-(--text-muted) hover:text-(--text-secondary) transition-colors"
            title={`${instanceInfo.software.name} v${instanceInfo.software.version}`}
          >
            {isCollapsed ? `v${instanceInfo.software.version.split(".")[0]}` : `v${instanceInfo.software.version}`}
          </SpaLink>
        </div>
      )}
    </>
  );

  return (
    <>
      {/* Mobile Header Bar */}
      <header className="lg:hidden fixed fixed-top-with-safe-area-bg left-0 right-0 z-40 bg-(--card-bg) border-b border-(--border-color) px-4 pb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(true)}
          className="p-2 -ml-2 rounded-lg text-(--text-muted) hover:bg-(--bg-tertiary) transition-colors cursor-pointer"
          aria-label="Open menu"
        >
          <Menu className="w-6 h-6" />
        </button>

        <SpaLink to="/timeline" className="flex items-center gap-2">
          <SpaLink to="/timeline" className="flex items-center gap-2">
            {effectiveIconUrl ? (
              <img
                src={effectiveIconUrl}
                alt={instanceInfo?.name || "Logo"}
                className="w-7 h-7 rounded-lg object-cover"
              />
            ) : null}
            <span className="text-lg font-bold text-primary-600">
              {instanceInfo?.name || "Rox"}
            </span>
          </SpaLink>
        </SpaLink>

        <SpaLink to={`/${currentUser.username}`} className="p-1 -mr-1 rounded-full">
          <Avatar
            src={currentUser.avatarUrl}
            alt={currentUser.name || currentUser.username}
            fallback={userInitials}
            size="sm"
          />
        </SpaLink>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/50"
          onClick={() => setIsMobileMenuOpen(false)}
          onKeyDown={(e) => e.key === "Escape" && setIsMobileMenuOpen(false)}
          role="button"
          tabIndex={0}
          aria-label="Close menu"
        />
      )}

      {/* Mobile Slide-in Menu */}
      <aside
        className={`lg:hidden fixed left-0 top-0 h-screen w-72 max-w-[85vw] bg-(--card-bg) border-r border-(--border-color) flex flex-col z-50 transform transition-transform duration-300 ease-in-out pt-[env(safe-area-inset-top)] ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Close button - positioned below safe area */}
        <div className="absolute top-[calc(0.75rem+env(safe-area-inset-top))] right-3">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(false)}
            className="p-2 rounded-lg text-(--text-muted) hover:bg-(--bg-tertiary) transition-colors cursor-pointer"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <MobileSidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex fixed left-0 top-0 h-screen bg-(--card-bg) border-r border-(--border-color) flex-col transition-all duration-300 ${
          isCollapsed ? "w-16" : "w-64"
        }`}
      >
        <DesktopSidebarContent />
      </aside>
    </>
  );
}
