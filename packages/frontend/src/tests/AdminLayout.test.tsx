/**
 * AdminLayout Component Tests
 *
 * Tests for the AdminLayout component's navigation structure and logic.
 * These are pure unit tests that don't require DOM rendering.
 */

import { describe, test, expect } from "bun:test";

/**
 * Navigation item structure (duplicated from component for testing)
 */
interface NavItem {
  href: string;
  label: string;
}

interface NavCategory {
  key: string;
  label: string;
  items: NavItem[];
}

/**
 * Admin navigation categories - mirrors the component's navigation structure
 * This allows us to verify the navigation structure without DOM rendering
 *
 * Settings, Emojis, and Queue pages have sub-tabs that are represented
 * as direct navigation items with query parameters.
 */
const ADMIN_NAV_CATEGORIES: NavCategory[] = [
  {
    key: "general",
    label: "General",
    items: [
      // Settings sub-tabs as direct items
      { href: "/admin/settings?tab=instance", label: "Instance" },
      { href: "/admin/settings?tab=registration", label: "Registration" },
      { href: "/admin/settings?tab=theme", label: "Theme" },
      { href: "/admin/settings?tab=assets", label: "Assets" },
      { href: "/admin/settings?tab=legal", label: "Legal" },
    ],
  },
  {
    key: "users",
    label: "Users",
    items: [
      { href: "/admin/users", label: "Users" },
      { href: "/admin/roles", label: "Roles" },
      { href: "/admin/invitations", label: "Invitations" },
      { href: "/admin/gone-users", label: "Gone Users" },
    ],
  },
  {
    key: "content",
    label: "Content",
    items: [
      // Emojis sub-tabs as direct items
      { href: "/admin/emojis?tab=local", label: "Local Emojis" },
      { href: "/admin/emojis?tab=remote", label: "Remote Emojis" },
      { href: "/admin/emojis?tab=import", label: "Bulk Import" },
      { href: "/admin/reports", label: "Reports" },
    ],
  },
  {
    key: "system",
    label: "System",
    items: [
      { href: "/admin/storage", label: "Storage" },
      { href: "/admin/federation", label: "Federation" },
      // Queue sub-tabs as direct items
      { href: "/admin/queue?tab=overview", label: "Queue Overview" },
      { href: "/admin/queue?tab=servers", label: "Queue Servers" },
      { href: "/admin/blocks", label: "Blocks" },
      { href: "/admin/contacts", label: "Contacts" },
    ],
  },
];

/**
 * Find current page info - mirrors the component's logic
 */
function findCurrentPage(path: string): { category: NavCategory; item: NavItem } | null {
  for (const category of ADMIN_NAV_CATEGORIES) {
    const item = category.items.find((i) => i.href === path);
    if (item) {
      return { category, item };
    }
  }
  return null;
}

describe("AdminLayout Navigation Structure", () => {
  describe("Category structure", () => {
    test("has exactly 4 categories", () => {
      expect(ADMIN_NAV_CATEGORIES).toHaveLength(4);
    });

    test("categories are in correct order", () => {
      const categoryKeys = ADMIN_NAV_CATEGORIES.map((c) => c.key);
      expect(categoryKeys).toEqual(["general", "users", "content", "system"]);
    });

    test("General category has 5 settings items", () => {
      const general = ADMIN_NAV_CATEGORIES.find((c) => c.key === "general");
      expect(general).toBeDefined();
      expect(general!.items).toHaveLength(5);

      const hrefs = general!.items.map((i) => i.href);
      expect(hrefs).toContain("/admin/settings?tab=instance");
      expect(hrefs).toContain("/admin/settings?tab=registration");
      expect(hrefs).toContain("/admin/settings?tab=theme");
      expect(hrefs).toContain("/admin/settings?tab=assets");
      expect(hrefs).toContain("/admin/settings?tab=legal");
    });

    test("Users category has 4 items", () => {
      const users = ADMIN_NAV_CATEGORIES.find((c) => c.key === "users");
      expect(users).toBeDefined();
      expect(users!.items).toHaveLength(4);

      const hrefs = users!.items.map((i) => i.href);
      expect(hrefs).toContain("/admin/users");
      expect(hrefs).toContain("/admin/roles");
      expect(hrefs).toContain("/admin/invitations");
      expect(hrefs).toContain("/admin/gone-users");
    });

    test("Content category has 4 items (emoji tabs + reports)", () => {
      const content = ADMIN_NAV_CATEGORIES.find((c) => c.key === "content");
      expect(content).toBeDefined();
      expect(content!.items).toHaveLength(4);

      const hrefs = content!.items.map((i) => i.href);
      expect(hrefs).toContain("/admin/emojis?tab=local");
      expect(hrefs).toContain("/admin/emojis?tab=remote");
      expect(hrefs).toContain("/admin/emojis?tab=import");
      expect(hrefs).toContain("/admin/reports");
    });

    test("System category has 6 items (queue tabs + others)", () => {
      const system = ADMIN_NAV_CATEGORIES.find((c) => c.key === "system");
      expect(system).toBeDefined();
      expect(system!.items).toHaveLength(6);

      const hrefs = system!.items.map((i) => i.href);
      expect(hrefs).toContain("/admin/storage");
      expect(hrefs).toContain("/admin/federation");
      expect(hrefs).toContain("/admin/queue?tab=overview");
      expect(hrefs).toContain("/admin/queue?tab=servers");
      expect(hrefs).toContain("/admin/blocks");
      expect(hrefs).toContain("/admin/contacts");
    });
  });

  describe("Navigation paths", () => {
    test("all admin pages have unique paths", () => {
      const allPaths = ADMIN_NAV_CATEGORIES.flatMap((c) => c.items.map((i) => i.href));
      const uniquePaths = new Set(allPaths);
      expect(uniquePaths.size).toBe(allPaths.length);
    });

    test("all paths start with /admin/", () => {
      const allPaths = ADMIN_NAV_CATEGORIES.flatMap((c) => c.items.map((i) => i.href));
      for (const path of allPaths) {
        expect(path.startsWith("/admin/")).toBe(true);
      }
    });

    test("expected admin pages are present", () => {
      const expectedPaths = [
        // Settings tabs
        "/admin/settings?tab=instance",
        "/admin/settings?tab=registration",
        "/admin/settings?tab=theme",
        "/admin/settings?tab=assets",
        "/admin/settings?tab=legal",
        // Users
        "/admin/users",
        "/admin/roles",
        "/admin/invitations",
        "/admin/gone-users",
        // Content (emojis tabs + reports)
        "/admin/emojis?tab=local",
        "/admin/emojis?tab=remote",
        "/admin/emojis?tab=import",
        "/admin/reports",
        // System (queue tabs + others)
        "/admin/storage",
        "/admin/federation",
        "/admin/queue?tab=overview",
        "/admin/queue?tab=servers",
        "/admin/blocks",
        "/admin/contacts",
      ];

      const allPaths = ADMIN_NAV_CATEGORIES.flatMap((c) => c.items.map((i) => i.href));

      for (const expected of expectedPaths) {
        expect(allPaths).toContain(expected);
      }
    });

    test("total admin pages count is 19", () => {
      const allPaths = ADMIN_NAV_CATEGORIES.flatMap((c) => c.items.map((i) => i.href));
      expect(allPaths).toHaveLength(19);
    });
  });

  describe("findCurrentPage function", () => {
    test("finds Instance settings page in General category", () => {
      const result = findCurrentPage("/admin/settings?tab=instance");
      expect(result).not.toBeNull();
      expect(result!.category.key).toBe("general");
      expect(result!.item.label).toBe("Instance");
    });

    test("finds Users page in Users category", () => {
      const result = findCurrentPage("/admin/users");
      expect(result).not.toBeNull();
      expect(result!.category.key).toBe("users");
      expect(result!.item.label).toBe("Users");
    });

    test("finds Roles page in Users category", () => {
      const result = findCurrentPage("/admin/roles");
      expect(result).not.toBeNull();
      expect(result!.category.key).toBe("users");
      expect(result!.item.label).toBe("Roles");
    });

    test("finds Local Emojis page in Content category", () => {
      const result = findCurrentPage("/admin/emojis?tab=local");
      expect(result).not.toBeNull();
      expect(result!.category.key).toBe("content");
      expect(result!.item.label).toBe("Local Emojis");
    });

    test("finds Federation page in System category", () => {
      const result = findCurrentPage("/admin/federation");
      expect(result).not.toBeNull();
      expect(result!.category.key).toBe("system");
      expect(result!.item.label).toBe("Federation");
    });

    test("finds Queue Overview page in System category", () => {
      const result = findCurrentPage("/admin/queue?tab=overview");
      expect(result).not.toBeNull();
      expect(result!.category.key).toBe("system");
      expect(result!.item.label).toBe("Queue Overview");
    });

    test("returns null for unknown path", () => {
      const result = findCurrentPage("/admin/unknown");
      expect(result).toBeNull();
    });

    test("returns null for non-admin path", () => {
      const result = findCurrentPage("/timeline");
      expect(result).toBeNull();
    });

    test("finds all pages correctly", () => {
      const allItems = ADMIN_NAV_CATEGORIES.flatMap((c) => c.items);

      for (const item of allItems) {
        const result = findCurrentPage(item.href);
        expect(result).not.toBeNull();
        expect(result!.item.href).toBe(item.href);
        expect(result!.item.label).toBe(item.label);
      }
    });
  });

  describe("Category expansion logic", () => {
    test("Settings Instance page should expand General category", () => {
      const result = findCurrentPage("/admin/settings?tab=instance");
      expect(result!.category.key).toBe("general");
    });

    test("Settings Theme page should expand General category", () => {
      const result = findCurrentPage("/admin/settings?tab=theme");
      expect(result!.category.key).toBe("general");
    });

    test("Users page should expand Users category", () => {
      const result = findCurrentPage("/admin/users");
      expect(result!.category.key).toBe("users");
    });

    test("Roles page should expand Users category", () => {
      const result = findCurrentPage("/admin/roles");
      expect(result!.category.key).toBe("users");
    });

    test("Invitations page should expand Users category", () => {
      const result = findCurrentPage("/admin/invitations");
      expect(result!.category.key).toBe("users");
    });

    test("Gone Users page should expand Users category", () => {
      const result = findCurrentPage("/admin/gone-users");
      expect(result!.category.key).toBe("users");
    });

    test("Local Emojis page should expand Content category", () => {
      const result = findCurrentPage("/admin/emojis?tab=local");
      expect(result!.category.key).toBe("content");
    });

    test("Remote Emojis page should expand Content category", () => {
      const result = findCurrentPage("/admin/emojis?tab=remote");
      expect(result!.category.key).toBe("content");
    });

    test("Reports page should expand Content category", () => {
      const result = findCurrentPage("/admin/reports");
      expect(result!.category.key).toBe("content");
    });

    test("Storage page should expand System category", () => {
      const result = findCurrentPage("/admin/storage");
      expect(result!.category.key).toBe("system");
    });

    test("Federation page should expand System category", () => {
      const result = findCurrentPage("/admin/federation");
      expect(result!.category.key).toBe("system");
    });

    test("Queue Overview page should expand System category", () => {
      const result = findCurrentPage("/admin/queue?tab=overview");
      expect(result!.category.key).toBe("system");
    });

    test("Queue Servers page should expand System category", () => {
      const result = findCurrentPage("/admin/queue?tab=servers");
      expect(result!.category.key).toBe("system");
    });

    test("Blocks page should expand System category", () => {
      const result = findCurrentPage("/admin/blocks");
      expect(result!.category.key).toBe("system");
    });

    test("Contacts page should expand System category", () => {
      const result = findCurrentPage("/admin/contacts");
      expect(result!.category.key).toBe("system");
    });
  });

  describe("Category labels", () => {
    test("all categories have labels", () => {
      for (const category of ADMIN_NAV_CATEGORIES) {
        expect(category.label).toBeTruthy();
        expect(typeof category.label).toBe("string");
      }
    });

    test("all items have labels", () => {
      const allItems = ADMIN_NAV_CATEGORIES.flatMap((c) => c.items);
      for (const item of allItems) {
        expect(item.label).toBeTruthy();
        expect(typeof item.label).toBe("string");
      }
    });
  });
});

describe("AdminLayout Props Interface", () => {
  // Test the interface expectations
  interface AdminLayoutProps {
    children: React.ReactNode;
    currentPath: string;
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    actions?: Array<{ key: string; label: React.ReactNode; onPress: () => void }>;
    showReload?: boolean;
    onReload?: () => void;
    isReloading?: boolean;
    tabs?: Array<{ key: string; label: React.ReactNode; icon?: React.ReactNode }>;
    activeTab?: string;
    onTabChange?: (key: string) => void;
  }

  test("interface has required properties", () => {
    // This is a compile-time check - if the interface is wrong, TypeScript will error
    const mockProps: AdminLayoutProps = {
      children: null,
      currentPath: "/admin/settings",
      title: "Test Title",
    };

    expect(mockProps.currentPath).toBe("/admin/settings");
    expect(mockProps.title).toBe("Test Title");
  });

  test("interface allows optional properties", () => {
    const mockProps: AdminLayoutProps = {
      children: null,
      currentPath: "/admin/settings",
      title: "Test Title",
      subtitle: "Test Subtitle",
      showReload: true,
      onReload: () => {},
      isReloading: false,
      tabs: [{ key: "tab1", label: "Tab 1" }],
      activeTab: "tab1",
      onTabChange: () => {},
      actions: [{ key: "action1", label: "Action 1", onPress: () => {} }],
    };

    expect(mockProps.subtitle).toBe("Test Subtitle");
    expect(mockProps.showReload).toBe(true);
    expect(mockProps.tabs).toHaveLength(1);
    expect(mockProps.activeTab).toBe("tab1");
    expect(mockProps.actions).toHaveLength(1);
  });
});
