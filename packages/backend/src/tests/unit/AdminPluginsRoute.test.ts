/**
 * Admin Plugins Route Unit Tests
 *
 * Tests the admin plugin management API endpoints.
 * Tests use the actual route implementations with mocked dependencies.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import type { PluginListEntry, InstalledPlugin, PluginSource, PluginInstallOptions } from "shared";

// Type for API responses
interface PluginListResponse {
  plugins: PluginListEntry[];
  total: number;
}

interface PluginActionResponse {
  success: boolean;
  message?: string;
  requiresRestart?: boolean;
  pluginId?: string;
  version?: string;
  config?: Record<string, unknown>;
  error?: string;
  warnings?: string[];
}

interface PluginConfigResponse {
  enabled?: boolean;
  keywords?: string[];
  [key: string]: unknown;
}

interface ErrorResponse {
  error: string;
}

// Install result type
interface InstallResult {
  success: boolean;
  pluginId?: string;
  version?: string;
  error?: string;
  warnings?: string[];
}

// Mock the PluginManager class methods
const mockList = mock(() => [] as PluginListEntry[]);
const mockGetPlugin = mock(() => undefined as InstalledPlugin | undefined);
const mockEnable = mock((_pluginId: string) => true);
const mockDisable = mock((_pluginId: string) => true);
const mockInstall = mock(
  async (_source: PluginSource, _options?: PluginInstallOptions): Promise<InstallResult> => ({
    success: true,
    pluginId: "test-plugin",
    version: "1.0.0",
  })
);
const mockUninstall = mock(async (_pluginId: string, _options?: { keepFiles?: boolean }) => true);
const mockIsInstalled = mock((_pluginId: string) => true);
const mockGetPluginConfig = mock((_pluginId: string) => ({}) as Record<string, unknown>);
const mockSetPluginConfig = mock((_pluginId: string, _config: Record<string, unknown>) => true);

// Mock the PluginManager module before importing routes
mock.module("../../plugins/PluginManager.js", () => ({
  PluginManager: class MockPluginManager {
    list = mockList;
    getPlugin = mockGetPlugin;
    enable = mockEnable;
    disable = mockDisable;
    install = mockInstall;
    uninstall = mockUninstall;
    isInstalled = mockIsInstalled;
    getPluginConfig = mockGetPluginConfig;
    setPluginConfig = mockSetPluginConfig;
  },
}));

// Mock the auth middleware to always pass
mock.module("../../middleware/auth.js", () => ({
  requireAdmin: () => async (_c: any, next: () => Promise<void>) => {
    await next();
  },
}));

// Import the actual routes after mocking dependencies
const { default: adminPluginsRoute } = await import("../../routes/admin-plugins.js");

describe("Admin Plugins Route", () => {
  beforeEach(() => {
    // Reset all mocks
    mockList.mockReset();
    mockGetPlugin.mockReset();
    mockEnable.mockReset();
    mockDisable.mockReset();
    mockInstall.mockReset();
    mockUninstall.mockReset();
    mockIsInstalled.mockReset();
    mockGetPluginConfig.mockReset();
    mockSetPluginConfig.mockReset();

    // Set default return values
    mockList.mockReturnValue([]);
    mockEnable.mockReturnValue(true);
    mockDisable.mockReturnValue(true);
    mockInstall.mockResolvedValue({
      success: true,
      pluginId: "test-plugin",
      version: "1.0.0",
    });
    mockUninstall.mockResolvedValue(true);
    mockIsInstalled.mockReturnValue(true);
    mockGetPluginConfig.mockReturnValue({});
    mockSetPluginConfig.mockReturnValue(true);
  });

  describe("GET /", () => {
    test("returns empty list when no plugins installed", async () => {
      mockList.mockReturnValue([]);

      const res = await adminPluginsRoute.request("/");
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginListResponse;
      expect(data.plugins).toEqual([]);
      expect(data.total).toBe(0);
      expect(mockList).toHaveBeenCalled();
    });

    test("returns list of installed plugins", async () => {
      const mockPlugins: PluginListEntry[] = [
        {
          id: "activity-logger",
          name: "Activity Logger",
          version: "1.0.0",
          description: "Logs activity",
          enabled: true,
          hasBackend: true,
          hasFrontend: false,
          source: "./plugins/activity-logger",
        },
        {
          id: "content-filter",
          name: "Content Filter",
          version: "2.0.0",
          description: "Filters content",
          enabled: false,
          hasBackend: true,
          hasFrontend: true,
          source: "https://github.com/user/content-filter",
        },
      ];
      mockList.mockReturnValue(mockPlugins);

      const res = await adminPluginsRoute.request("/");
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginListResponse;
      expect(data.plugins).toHaveLength(2);
      expect(data.total).toBe(2);
      expect(data.plugins[0]?.id).toBe("activity-logger");
      expect(data.plugins[1]?.id).toBe("content-filter");
    });
  });

  describe("GET /:id", () => {
    test("returns plugin details", async () => {
      const mockPlugin: InstalledPlugin = {
        id: "activity-logger",
        name: "Activity Logger",
        version: "1.0.0",
        description: "Logs activity",
        author: "Rox Team",
        license: "MIT",
        enabled: true,
        installedAt: "2025-01-01T00:00:00.000Z",
        source: "./plugins/activity-logger",
        permissions: ["note:read"],
        backend: "index.ts",
      };
      mockGetPlugin.mockReturnValue(mockPlugin);

      const res = await adminPluginsRoute.request("/activity-logger");
      expect(res.status).toBe(200);

      const data = (await res.json()) as InstalledPlugin;
      expect(data.id).toBe("activity-logger");
      expect(data.name).toBe("Activity Logger");
      expect(data.author).toBe("Rox Team");

      // Verify the correct plugin ID was requested
      expect(mockGetPlugin).toHaveBeenCalledWith("activity-logger");
    });

    test("returns 404 for non-existent plugin", async () => {
      mockGetPlugin.mockReturnValue(undefined);

      const res = await adminPluginsRoute.request("/non-existent");
      expect(res.status).toBe(404);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toBe("Plugin not found");
      expect(mockGetPlugin).toHaveBeenCalledWith("non-existent");
    });
  });

  describe("POST /:id/enable", () => {
    test("enables a plugin", async () => {
      mockEnable.mockReturnValue(true);

      const res = await adminPluginsRoute.request("/activity-logger/enable", {
        method: "POST",
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginActionResponse;
      expect(data.success).toBe(true);
      expect(data.message).toBe("Plugin enabled");
      expect(data.requiresRestart).toBe(true);

      // Verify the correct plugin ID was passed
      expect(mockEnable).toHaveBeenCalledWith("activity-logger");
    });

    test("returns 404 for non-existent plugin", async () => {
      mockEnable.mockReturnValue(false);

      const res = await adminPluginsRoute.request("/non-existent/enable", {
        method: "POST",
      });
      expect(res.status).toBe(404);
      expect(mockEnable).toHaveBeenCalledWith("non-existent");
    });
  });

  describe("POST /:id/disable", () => {
    test("disables a plugin", async () => {
      mockDisable.mockReturnValue(true);

      const res = await adminPluginsRoute.request("/activity-logger/disable", {
        method: "POST",
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginActionResponse;
      expect(data.success).toBe(true);
      expect(data.message).toBe("Plugin disabled");
      expect(data.requiresRestart).toBe(true);

      // Verify the correct plugin ID was passed
      expect(mockDisable).toHaveBeenCalledWith("activity-logger");
    });

    test("returns 404 for non-existent plugin", async () => {
      mockDisable.mockReturnValue(false);

      const res = await adminPluginsRoute.request("/non-existent/disable", {
        method: "POST",
      });
      expect(res.status).toBe(404);
      expect(mockDisable).toHaveBeenCalledWith("non-existent");
    });
  });

  describe("POST /install", () => {
    test("installs a plugin from Git URL", async () => {
      mockInstall.mockResolvedValue({
        success: true,
        pluginId: "my-plugin",
        version: "1.0.0",
      });

      const res = await adminPluginsRoute.request("/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "https://github.com/user/my-plugin",
        }),
      });
      expect(res.status).toBe(201);

      const data = (await res.json()) as PluginActionResponse;
      expect(data.success).toBe(true);
      expect(data.pluginId).toBe("my-plugin");
      expect(data.version).toBe("1.0.0");
      expect(data.requiresRestart).toBe(true);

      // Verify install was called with correct source type
      expect(mockInstall).toHaveBeenCalledWith(
        { type: "git", url: "https://github.com/user/my-plugin" },
        { force: undefined, enable: true }
      );
    });

    test("installs a plugin from local path", async () => {
      mockInstall.mockResolvedValue({
        success: true,
        pluginId: "local-plugin",
        version: "1.0.0",
      });

      const res = await adminPluginsRoute.request("/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "./plugins/local-plugin",
        }),
      });
      expect(res.status).toBe(201);

      // Verify install was called with local source type
      expect(mockInstall).toHaveBeenCalledWith(
        { type: "local", path: "./plugins/local-plugin" },
        { force: undefined, enable: true }
      );
    });

    test("passes force option when specified", async () => {
      mockInstall.mockResolvedValue({
        success: true,
        pluginId: "my-plugin",
        version: "1.0.0",
      });

      const res = await adminPluginsRoute.request("/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "https://github.com/user/my-plugin",
          force: true,
        }),
      });
      expect(res.status).toBe(201);

      // Verify force option was passed
      expect(mockInstall).toHaveBeenCalledWith(
        { type: "git", url: "https://github.com/user/my-plugin" },
        { force: true, enable: true }
      );
    });

    test("returns 400 when source is missing", async () => {
      const res = await adminPluginsRoute.request("/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toBe("source is required");
    });

    test("returns 400 when installation fails", async () => {
      mockInstall.mockResolvedValue({
        success: false,
        error: "Invalid manifest",
      });

      const res = await adminPluginsRoute.request("/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source: "https://github.com/user/invalid-plugin",
        }),
      });
      expect(res.status).toBe(400);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toBe("Invalid manifest");
    });

    test("returns 400 for invalid JSON body", async () => {
      const res = await adminPluginsRoute.request("/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json",
      });
      expect(res.status).toBe(400);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toBe("Invalid JSON body");
    });
  });

  describe("DELETE /:id", () => {
    test("uninstalls a plugin", async () => {
      mockUninstall.mockResolvedValue(true);

      const res = await adminPluginsRoute.request("/activity-logger", {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginActionResponse;
      expect(data.success).toBe(true);
      expect(data.message).toBe("Plugin uninstalled");
      expect(data.requiresRestart).toBe(true);

      // Verify the correct plugin ID was passed
      expect(mockUninstall).toHaveBeenCalledWith("activity-logger", { keepFiles: false });
    });

    test("uninstalls a plugin while keeping files", async () => {
      mockUninstall.mockResolvedValue(true);

      const res = await adminPluginsRoute.request("/activity-logger?keepFiles=true", {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      // Verify keepFiles option was passed
      expect(mockUninstall).toHaveBeenCalledWith("activity-logger", { keepFiles: true });
    });

    test("returns 404 for non-existent plugin", async () => {
      mockUninstall.mockResolvedValue(false);

      const res = await adminPluginsRoute.request("/non-existent", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
      expect(mockUninstall).toHaveBeenCalledWith("non-existent", { keepFiles: false });
    });
  });

  describe("GET /:id/config", () => {
    test("returns plugin configuration", async () => {
      mockIsInstalled.mockReturnValue(true);
      mockGetPluginConfig.mockReturnValue({
        enabled: true,
        keywords: ["spoiler", "nsfw"],
      });

      const res = await adminPluginsRoute.request("/activity-logger/config");
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginConfigResponse;
      expect(data.enabled).toBe(true);
      expect(data.keywords).toEqual(["spoiler", "nsfw"]);

      // Verify the correct plugin ID was passed
      expect(mockIsInstalled).toHaveBeenCalledWith("activity-logger");
      expect(mockGetPluginConfig).toHaveBeenCalledWith("activity-logger");
    });

    test("returns 404 for non-existent plugin", async () => {
      mockIsInstalled.mockReturnValue(false);

      const res = await adminPluginsRoute.request("/non-existent/config");
      expect(res.status).toBe(404);
      expect(mockIsInstalled).toHaveBeenCalledWith("non-existent");
    });
  });

  describe("PUT /:id/config", () => {
    test("updates plugin configuration", async () => {
      mockIsInstalled.mockReturnValue(true);
      mockSetPluginConfig.mockReturnValue(true);

      const newConfig = {
        enabled: true,
        keywords: ["spoiler", "nsfw", "tw"],
      };

      const res = await adminPluginsRoute.request("/activity-logger/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginActionResponse;
      expect(data.success).toBe(true);
      expect(data.config).toEqual(newConfig);

      // Verify the correct plugin ID and config were passed
      expect(mockIsInstalled).toHaveBeenCalledWith("activity-logger");
      expect(mockSetPluginConfig).toHaveBeenCalledWith("activity-logger", newConfig);
    });

    test("returns 404 for non-existent plugin", async () => {
      mockIsInstalled.mockReturnValue(false);

      const res = await adminPluginsRoute.request("/non-existent/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      expect(res.status).toBe(404);
      expect(mockIsInstalled).toHaveBeenCalledWith("non-existent");
    });

    test("returns 400 for invalid JSON body", async () => {
      mockIsInstalled.mockReturnValue(true);

      const res = await adminPluginsRoute.request("/activity-logger/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "invalid-json",
      });
      expect(res.status).toBe(400);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toBe("Invalid JSON body");
    });
  });

  describe("POST /:id/reload", () => {
    test("returns 503 when plugin loader is not configured", async () => {
      const res = await adminPluginsRoute.request("/activity-logger/reload", {
        method: "POST",
      });
      expect(res.status).toBe(503);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toBe("Hot reload not available. Plugin loader not configured.");
    });
  });

  describe("POST /reload-all", () => {
    test("returns 503 when plugin loader is not configured", async () => {
      const res = await adminPluginsRoute.request("/reload-all", {
        method: "POST",
      });
      expect(res.status).toBe(503);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toBe("Hot reload not available. Plugin loader not configured.");
    });
  });
});
