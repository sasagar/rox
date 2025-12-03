"use client";

import { useAtom } from "jotai";
import { currentUserAtom } from "../../lib/atoms/auth";
import { sidebarCollapsedAtom } from "../../lib/atoms/sidebar";
import { Sidebar } from "./Sidebar";
import { useUISettings } from "../../lib/hooks/useUISettings";

/**
 * Props for the Layout component
 */
export interface LayoutProps {
  /** Child components to render in the main content area */
  children: React.ReactNode;
  /** Whether to show the sidebar (false for login/signup pages) */
  showSidebar?: boolean;
  /** Maximum width for the content area */
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "full" | "auto";
}

/**
 * Main layout component with Misskey-style sidebar
 * Provides consistent layout structure across authenticated pages
 * Applies user UI settings (font size, line height, content width, theme)
 */
export function Layout({ children, showSidebar = true, maxWidth = "2xl" }: LayoutProps) {
  const [currentUser] = useAtom(currentUserAtom);
  const [isCollapsed] = useAtom(sidebarCollapsedAtom);

  // Apply UI settings (CSS variables, theme, custom CSS)
  useUISettings();

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    full: "max-w-full",
    auto: "rox-content-container", // Uses CSS variable --rox-content-width
  }[maxWidth];

  // Don't show sidebar if user not logged in or explicitly disabled
  const shouldShowSidebar = showSidebar && currentUser;

  // Sidebar margin: 64px when collapsed, 256px (16rem) when expanded
  const sidebarMarginClass = shouldShowSidebar
    ? isCollapsed
      ? "lg:ml-16 pt-16 lg:pt-0"
      : "lg:ml-64 pt-16 lg:pt-0"
    : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Sidebar */}
      {shouldShowSidebar && <Sidebar />}

      {/* Main Content Area */}
      <main className={`min-h-screen transition-all duration-300 ${sidebarMarginClass}`}>
        {/* Page Content */}
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
          <div className={`${maxWidthClass} mx-auto rox-content`}>{children}</div>
        </div>
      </main>
    </div>
  );
}
