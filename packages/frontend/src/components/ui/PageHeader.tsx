"use client";

import { type ReactNode, type Key } from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { Button as AriaButton } from "react-aria-components";
import {
  Tabs as AriaTabs,
  TabList as AriaTabList,
  Tab as AriaTab,
} from "react-aria-components";

/**
 * Tab item configuration
 */
export interface PageHeaderTab {
  /** Unique key for the tab */
  key: string;
  /** Tab label */
  label: ReactNode;
  /** Optional icon */
  icon?: ReactNode;
}

/**
 * Action button configuration
 */
export interface PageHeaderAction {
  /** Unique key for the action */
  key: string;
  /** Action label */
  label: ReactNode;
  /** Optional icon */
  icon?: ReactNode;
  /** Click handler */
  onPress: () => void;
  /** Button variant */
  variant?: "primary" | "secondary" | "danger";
}

/**
 * Props for PageHeader component
 */
export interface PageHeaderProps {
  /** Page title */
  title: ReactNode;
  /** Optional subtitle */
  subtitle?: ReactNode;
  /** Optional icon displayed before title */
  icon?: ReactNode;

  /** Back navigation URL */
  backHref?: string;
  /** Back button label (shown on larger screens) */
  backLabel?: ReactNode;

  /** Tab items */
  tabs?: PageHeaderTab[];
  /** Currently active tab key */
  activeTab?: string;
  /** Tab change handler */
  onTabChange?: (key: string) => void;

  /** Action buttons */
  actions?: PageHeaderAction[];

  /** Show reload button */
  showReload?: boolean;
  /** Reload handler */
  onReload?: () => void;
  /** Loading state for reload */
  isReloading?: boolean;

  /**
   * When true, extends header to full width of parent container
   * with negative margins and applies padding internally.
   * Use this for top-of-page headers in Layout.
   * @default true
   */
  fullWidth?: boolean;

  /** Additional CSS classes */
  className?: string;
}

/**
 * Unified page header component
 *
 * Provides consistent header styling across all pages with support for:
 * - Title and subtitle
 * - Back navigation
 * - Integrated tabs (using React Aria for keyboard navigation)
 * - Action buttons (using React Aria Button)
 * - Reload functionality
 *
 * @example
 * ```tsx
 * // Simple header
 * <PageHeader title={<Trans>Search</Trans>} />
 *
 * // Header with tabs
 * <PageHeader
 *   title={<Trans>Timeline</Trans>}
 *   tabs={[
 *     { key: "local", label: <Trans>Local</Trans> },
 *     { key: "global", label: <Trans>Global</Trans> },
 *   ]}
 *   activeTab={currentTab}
 *   onTabChange={setCurrentTab}
 *   showReload
 *   onReload={handleRefresh}
 * />
 *
 * // Header with back button
 * <PageHeader
 *   title={<Trans>Note</Trans>}
 *   backHref="/timeline"
 *   backLabel={<Trans>Back</Trans>}
 * />
 * ```
 */
export function PageHeader({
  title,
  subtitle,
  icon,
  backHref,
  backLabel,
  tabs,
  activeTab,
  onTabChange,
  actions,
  showReload,
  onReload,
  isReloading,
  fullWidth = true,
  className = "",
}: PageHeaderProps) {
  const handleSelectionChange = (key: Key) => {
    onTabChange?.(String(key));
  };

  // Full width styling: extends to edges and removes top margin from Layout padding
  const fullWidthClasses = fullWidth
    ? "-mx-3 sm:-mx-4 -mt-4 sm:-mt-6 lg:-mt-8 mb-4 sm:mb-6"
    : "";

  return (
    <div
      className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${fullWidthClasses} ${className}`}
    >
      {/* Main header row */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left section: Back button + Title */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {/* Back button */}
            {backHref && (
              <a
                href={backHref}
                className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors shrink-0"
              >
                <ArrowLeft className="w-5 h-5" />
                {backLabel && (
                  <span className="hidden sm:inline text-sm">{backLabel}</span>
                )}
              </a>
            )}

            {/* Icon */}
            {icon && (
              <div className="text-gray-600 dark:text-gray-400 shrink-0">
                {icon}
              </div>
            )}

            {/* Title and subtitle */}
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-gray-500 dark:text-gray-400 truncate hidden sm:block">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right section: Reload + Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Reload button - using React Aria Button */}
            {showReload && onReload && (
              <AriaButton
                onPress={onReload}
                isDisabled={isReloading}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2"
                aria-label="Reload"
              >
                <RefreshCw
                  className={`w-5 h-5 ${isReloading ? "animate-spin" : ""}`}
                />
              </AriaButton>
            )}

            {/* Action buttons - using React Aria Button */}
            {actions?.map((action) => (
              <AriaButton
                key={action.key}
                onPress={action.onPress}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                  action.variant === "primary"
                    ? "bg-primary-600 hover:bg-primary-700 text-white focus-visible:ring-primary-500"
                    : action.variant === "danger"
                      ? "bg-red-600 hover:bg-red-700 text-white focus-visible:ring-red-500"
                      : "bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 focus-visible:ring-gray-500"
                }`}
              >
                {action.icon}
                <span className="hidden sm:inline">{action.label}</span>
              </AriaButton>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs row - using React Aria Tabs */}
      {tabs && tabs.length > 0 && (
        <div className="px-4 border-t border-gray-100 dark:border-gray-700/50">
          <AriaTabs
            selectedKey={activeTab}
            onSelectionChange={handleSelectionChange}
          >
            <AriaTabList
              aria-label="Page navigation"
              className="flex gap-1 overflow-x-auto scrollbar-hide -mb-px"
            >
              {tabs.map((tab) => (
                <AriaTab
                  key={tab.key}
                  id={tab.key}
                  className={({ isSelected, isFocusVisible }) =>
                    `flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer outline-none ${
                      isSelected
                        ? "border-primary-500 text-primary-600 dark:text-primary-400"
                        : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:border-gray-300 dark:hover:border-gray-600"
                    } ${isFocusVisible ? "ring-2 ring-primary-500 ring-inset" : ""}`
                  }
                >
                  {tab.icon}
                  {tab.label}
                </AriaTab>
              ))}
            </AriaTabList>
          </AriaTabs>
        </div>
      )}
    </div>
  );
}
