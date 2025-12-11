"use client";

import { useAtomValue } from "jotai";
import { Trans } from "@lingui/react/macro";
import { currentUserAtom } from "../../lib/atoms/auth";
import { sidebarCollapsedAtom } from "../../lib/atoms/sidebar";
import { Sidebar } from "./Sidebar";
import { MobileAppBar } from "./MobileAppBar";
import { ComposeModal } from "../note/ComposeModal";
import { useUISettings } from "../../lib/hooks/useUISettings";
import { useInstanceInfo } from "../../hooks/useInstanceInfo";
import { SpaLink } from "../ui/SpaLink";

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
  /**
   * Optional header component (e.g., PageHeader) to render full-width
   * above the content container. This allows the header to span the
   * entire width of the main area without being constrained by maxWidth.
   */
  header?: React.ReactNode;
}

/**
 * Main layout component with Misskey-style sidebar
 * Provides consistent layout structure across authenticated pages
 * Applies user UI settings (font size, line height, content width, theme)
 */
export function Layout({ children, showSidebar = true, maxWidth = "2xl", header }: LayoutProps) {
  const currentUser = useAtomValue(currentUserAtom);
  const isCollapsed = useAtomValue(sidebarCollapsedAtom);
  const { instanceInfo } = useInstanceInfo();

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
  // Also add bottom padding on mobile for the AppBar (pb-16 = 4rem = 64px)
  const sidebarMarginClass = shouldShowSidebar
    ? isCollapsed
      ? "lg:ml-16 pt-16 lg:pt-0 pb-16 lg:pb-0"
      : "lg:ml-64 pt-16 lg:pt-0 pb-16 lg:pb-0"
    : "";

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      {/* Sidebar */}
      {shouldShowSidebar && <Sidebar />}

      {/* Main Content Area */}
      <main className={`min-h-screen transition-all duration-300 ${sidebarMarginClass}`}>
        {/* Full-width header (e.g., PageHeader) - sticky for consistent navigation */}
        {header && (
          <div className="sticky top-0 z-30 w-full bg-(--bg-primary)/95 backdrop-blur-sm border-b border-(--border-color)">
            {header}
          </div>
        )}

        {/* Page Content */}
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
          <div className={`${maxWidthClass} mx-auto rox-content`}>{children}</div>
        </div>

        {/* Footer with legal links */}
        <footer className="border-t border-(--border-color) py-4 mt-8">
          <div className="container mx-auto px-3 sm:px-4">
            <div className={`${maxWidthClass} mx-auto flex flex-wrap justify-center gap-4 text-xs text-(--text-muted)`}>
              <a
                href={instanceInfo?.tosUrl || "/legal/terms"}
                className="hover:text-(--text-primary)"
                target={instanceInfo?.tosUrl ? "_blank" : undefined}
                rel={instanceInfo?.tosUrl ? "noopener noreferrer" : undefined}
              >
                <Trans>Terms</Trans>
              </a>
              <a
                href={instanceInfo?.privacyPolicyUrl || "/legal/privacy"}
                className="hover:text-(--text-primary)"
                target={instanceInfo?.privacyPolicyUrl ? "_blank" : undefined}
                rel={instanceInfo?.privacyPolicyUrl ? "noopener noreferrer" : undefined}
              >
                <Trans>Privacy</Trans>
              </a>
              <SpaLink to="/legal/licenses" className="hover:text-(--text-primary)">
                <Trans>Licenses</Trans>
              </SpaLink>
            </div>
          </div>
        </footer>
      </main>

      {/* Mobile Bottom Navigation Bar */}
      {shouldShowSidebar && <MobileAppBar />}

      {/* Compose Modal (for mobile post button) */}
      {shouldShowSidebar && <ComposeModal />}
    </div>
  );
}
