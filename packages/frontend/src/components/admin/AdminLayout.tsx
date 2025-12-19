"use client";

/**
 * Admin Layout Component
 *
 * Two-column layout for admin pages:
 * - Desktop (lg+): Sidebar navigation + Content area
 * - Mobile/Tablet: Collapsible menu + Content area
 */

import { useState } from "react";
import { Trans, useLingui } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import type { MessageDescriptor } from "@lingui/core";
import {
  Settings,
  Users,
  UserCog,
  Ticket,
  Shield,
  AlertTriangle,
  Smile,
  HardDrive,
  Globe,
  MessageCircle,
  Ghost,
  ChevronDown,
  ChevronRight,
  X,
  Menu,
  LayoutDashboard,
  Building,
  UserPlus,
  Palette,
  ImageIcon,
  Scale,
  Archive,
  Server,
  BarChart3,
  Ban,
  UserCheck,
} from "lucide-react";
import { Layout } from "../layout/Layout";
import { PageHeader } from "../ui/PageHeader";

/**
 * Navigation item structure
 */
interface NavItem {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: MessageDescriptor;
}

/**
 * Navigation category structure
 */
interface NavCategory {
  key: string;
  label: MessageDescriptor;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
}

/**
 * Categorized admin navigation items
 *
 * Settings, Emojis, and Queue pages have sub-tabs that are represented
 * as direct navigation items with query parameters.
 */
const ADMIN_NAV_CATEGORIES: NavCategory[] = [
  {
    key: "general",
    label: msg`General`,
    icon: Settings,
    items: [
      // Settings sub-tabs as direct items
      { href: "/admin/settings?tab=instance", icon: Building, label: msg`Instance` },
      { href: "/admin/settings?tab=registration", icon: UserPlus, label: msg`Registration` },
      { href: "/admin/settings?tab=theme", icon: Palette, label: msg`Theme` },
      { href: "/admin/settings?tab=assets", icon: ImageIcon, label: msg`Assets` },
      { href: "/admin/settings?tab=legal", icon: Scale, label: msg`Legal` },
    ],
  },
  {
    key: "users",
    label: msg`Users`,
    icon: Users,
    items: [
      { href: "/admin/users", icon: UserCog, label: msg`Users` },
      { href: "/admin/roles", icon: Users, label: msg`Roles` },
      { href: "/admin/invitations", icon: Ticket, label: msg`Invitations` },
      { href: "/admin/blocked-usernames", icon: Ban, label: msg`Blocked Usernames` },
      { href: "/admin/gone-users", icon: Ghost, label: msg`Gone Users` },
    ],
  },
  {
    key: "content",
    label: msg`Content`,
    icon: Smile,
    items: [
      // Emojis sub-tabs as direct items
      { href: "/admin/emojis?tab=local", icon: Smile, label: msg`Local Emojis` },
      { href: "/admin/emojis?tab=remote", icon: Globe, label: msg`Remote Emojis` },
      { href: "/admin/emojis?tab=import", icon: Archive, label: msg`Bulk Import` },
      { href: "/admin/reports", icon: AlertTriangle, label: msg`Reports` },
    ],
  },
  {
    key: "system",
    label: msg`System`,
    icon: HardDrive,
    items: [
      { href: "/admin/storage", icon: HardDrive, label: msg`Storage` },
      { href: "/admin/federation", icon: Globe, label: msg`Federation` },
      { href: "/admin/system-follows", icon: UserCheck, label: msg`System Follows` },
      // Queue sub-tabs as direct items
      { href: "/admin/queue?tab=overview", icon: BarChart3, label: msg`Queue Overview` },
      { href: "/admin/queue?tab=servers", icon: Server, label: msg`Queue Servers` },
      { href: "/admin/blocks", icon: Shield, label: msg`Blocks` },
      { href: "/admin/contacts", icon: MessageCircle, label: msg`Contacts` },
    ],
  },
];

/**
 * Find current page info
 *
 * Matches both exact paths and paths with query parameters.
 * For example, "/admin/settings?tab=instance" matches the item with that exact href,
 * and "/admin/settings" (without query) will match the first settings item.
 */
function findCurrentPage(path: string): { category: NavCategory; item: NavItem } | null {
  // First try exact match (including query params)
  for (const category of ADMIN_NAV_CATEGORIES) {
    const item = category.items.find((i) => i.href === path);
    if (item) {
      return { category, item };
    }
  }

  // If no exact match, try matching by base path (without query params)
  const basePath = path.split("?")[0];
  for (const category of ADMIN_NAV_CATEGORIES) {
    const item = category.items.find((i) => i.href.split("?")[0] === basePath);
    if (item) {
      return { category, item };
    }
  }

  return null;
}

/**
 * Check if a navigation item matches the current path
 */
function isNavItemActive(itemHref: string, currentPath: string): boolean {
  // Exact match
  if (itemHref === currentPath) return true;

  // Match by base path and query param
  const itemBase = itemHref.split("?")[0];
  const currentBase = currentPath.split("?")[0];

  if (itemBase !== currentBase) return false;

  // If item has query param, check if it matches
  const itemParams = new URLSearchParams(itemHref.split("?")[1] || "");
  const currentParams = new URLSearchParams(currentPath.split("?")[1] || "");

  const itemTab = itemParams.get("tab");
  const currentTab = currentParams.get("tab");

  // If both have tab params, they must match
  if (itemTab && currentTab) {
    return itemTab === currentTab;
  }

  // If current path has no tab param, match the first item for that base path
  if (!currentTab && itemTab) {
    // Check if this is the first item for this base path
    for (const category of ADMIN_NAV_CATEGORIES) {
      const firstItem = category.items.find((i) => i.href.split("?")[0] === itemBase);
      if (firstItem) {
        return firstItem.href === itemHref;
      }
    }
  }

  return false;
}

interface AdminLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ComponentProps<typeof PageHeader>["actions"];
  showReload?: boolean;
  onReload?: () => void;
  isReloading?: boolean;
}

/**
 * Sidebar navigation component
 */
function AdminSidebar({
  currentPath,
  expandedCategories,
  onToggleCategory,
}: {
  currentPath: string;
  expandedCategories: Set<string>;
  onToggleCategory: (key: string) => void;
}) {
  const { t } = useLingui();

  return (
    <nav className="space-y-1">
      {ADMIN_NAV_CATEGORIES.map((category) => {
        const CategoryIcon = category.icon;
        const isExpanded = expandedCategories.has(category.key);
        const hasActiveItem = category.items.some((item) => isNavItemActive(item.href, currentPath));

        return (
          <div key={category.key}>
            {/* Category header */}
            <button
              onClick={() => onToggleCategory(category.key)}
              className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                hasActiveItem
                  ? "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20"
                  : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-tertiary)"
              }`}
            >
              <span className="flex items-center gap-2">
                <CategoryIcon className="w-4 h-4" />
                {t(category.label)}
              </span>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
            </button>

            {/* Category items */}
            {isExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                {category.items.map((item) => {
                  const ItemIcon = item.icon;
                  const isActive = isNavItemActive(item.href, currentPath);

                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                        isActive
                          ? "bg-primary-600 text-white"
                          : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-tertiary)"
                      }`}
                    >
                      <ItemIcon className="w-4 h-4" />
                      {t(item.label)}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}

/**
 * Mobile navigation menu
 */
function MobileAdminNav({
  currentPath,
  isOpen,
  onClose,
}: {
  currentPath: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { t } = useLingui();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-(--card-bg) shadow-xl overflow-y-auto pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
        <div className="flex items-center justify-between p-4 border-b border-(--border-color)">
          <span className="font-semibold text-(--text-primary)">
            <Trans>Admin Menu</Trans>
          </span>
          <button
            onClick={onClose}
            className="p-2 text-(--text-muted) hover:text-(--text-primary) rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <nav className="space-y-1">
            {ADMIN_NAV_CATEGORIES.map((category) => (
              <div key={category.key} className="mb-4">
                <div className="px-3 py-1 text-xs font-semibold text-(--text-muted) uppercase tracking-wider">
                  {t(category.label)}
                </div>
                <div className="mt-1 space-y-1">
                  {category.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = isNavItemActive(item.href, currentPath);

                    return (
                      <a
                        key={item.href}
                        href={item.href}
                        onClick={onClose}
                        className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                          isActive
                            ? "bg-primary-600 text-white"
                            : "text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-tertiary)"
                        }`}
                      >
                        <ItemIcon className="w-4 h-4" />
                        {t(item.label)}
                      </a>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}

export function AdminLayout({
  children,
  currentPath,
  title,
  subtitle,
  actions,
  showReload,
  onReload,
  isReloading,
}: AdminLayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Expand categories that contain the current page by default
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const current = findCurrentPage(currentPath);
    const initialExpanded = new Set<string>();
    if (current) {
      initialExpanded.add(current.category.key);
    }
    return initialExpanded;
  });

  const toggleCategory = (key: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const currentPage = findCurrentPage(currentPath);
  const CurrentIcon = currentPage?.item.icon || LayoutDashboard;

  // Add mobile menu button as the first action (hidden on desktop lg+)
  const combinedActions = [
    {
      key: "mobile-menu",
      icon: <Menu className="w-4 h-4" />,
      label: <Trans>Menu</Trans>,
      onPress: () => setMobileMenuOpen(true),
      variant: "secondary" as const,
      className: "lg:hidden",
    },
    ...(actions || []),
  ];

  const pageHeader = (
    <PageHeader
      title={title}
      subtitle={subtitle}
      icon={<CurrentIcon className="w-6 h-6" />}
      actions={combinedActions}
      showReload={showReload}
      onReload={onReload}
      isReloading={isReloading}
    />
  );

  return (
    <Layout header={pageHeader} maxWidth="full">
      <div className="flex gap-6">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-56 shrink-0">
          <div className="sticky top-24 bg-(--card-bg) rounded-lg border border-(--border-color) p-4">
            <AdminSidebar
              currentPath={currentPath}
              expandedCategories={expandedCategories}
              onToggleCategory={toggleCategory}
            />
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">{children}</div>
      </div>

      {/* Mobile Navigation */}
      <MobileAdminNav
        currentPath={currentPath}
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
    </Layout>
  );
}
