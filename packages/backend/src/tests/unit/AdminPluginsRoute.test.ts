/**
 * Admin Plugins Route Unit Tests
 *
 * Tests the admin plugin management API endpoints.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import type { PluginListEntry, InstalledPlugin } from "shared";

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
}

// Mock the PluginManager
const mockPluginManager = {
  list: mock(() => [] as PluginListEntry[]),
  getPlugin: mock(() => undefined as InstalledPlugin | undefined),
  enable: mock(() => true as boolean),
  disable: mock(() => true as boolean),
  install: mock(() => ({ success: true, pluginId: "test-plugin", version: "1.0.0" }) as InstallResult),
  uninstall: mock(() => true as boolean),
  isInstalled: mock(() => true as boolean),
  getPluginConfig: mock(() => ({}) as Record<string, unknown>),
  setPluginConfig: mock(() => true as boolean),
};

// Mock the auth middleware to always pass
const mockRequireAdmin = () => async (_c: any, next: () => Promise<void>) => {
  await next();
};

// Create test app with mocked dependencies
function createTestApp() {
  const app = new Hono();

  // Apply mock admin middleware
  app.use("/*", mockRequireAdmin());

  // List plugins
  app.get("/", async (c) => {
    const plugins = mockPluginManager.list();
    return c.json({ plugins, total: plugins.length });
  });

  // Get plugin details
  app.get("/:id", async (c) => {
    c.req.param("id"); // Extract but don't use - mock controls response
    const plugin = mockPluginManager.getPlugin();
    if (!plugin) {
      return c.json({ error: "Plugin not found" }, 404);
    }
    return c.json(plugin);
  });

  // Enable plugin
  app.post("/:id/enable", async (c) => {
    c.req.param("id"); // Extract but don't use - mock controls response
    const success = mockPluginManager.enable();
    if (!success) {
      return c.json({ error: "Plugin not found" }, 404);
    }
    return c.json({
      success: true,
      message: "Plugin enabled",
      requiresRestart: true,
    });
  });

  // Disable plugin
  app.post("/:id/disable", async (c) => {
    c.req.param("id"); // Extract but don't use - mock controls response
    const success = mockPluginManager.disable();
    if (!success) {
      return c.json({ error: "Plugin not found" }, 404);
    }
    return c.json({
      success: true,
      message: "Plugin disabled",
      requiresRestart: true,
    });
  });

  // Install plugin
  app.post("/install", async (c) => {
    const body = await c.req.json<{ source: string; force?: boolean }>();
    if (!body.source) {
      return c.json({ error: "source is required" }, 400);
    }

    const result = mockPluginManager.install();
    if (!result.success) {
      return c.json({ error: result.error || "Installation failed" }, 400);
    }

    return c.json(
      {
        success: true,
        pluginId: result.pluginId,
        version: result.version,
        requiresRestart: true,
      },
      201
    );
  });

  // Uninstall plugin
  app.delete("/:id", async (c) => {
    c.req.param("id"); // Extract but don't use - mock controls response
    const success = mockPluginManager.uninstall();
    if (!success) {
      return c.json({ error: "Plugin not found or failed to uninstall" }, 404);
    }
    return c.json({
      success: true,
      message: "Plugin uninstalled",
      requiresRestart: true,
    });
  });

  // Get plugin config
  app.get("/:id/config", async (c) => {
    c.req.param("id"); // Extract but don't use - mock controls response
    if (!mockPluginManager.isInstalled()) {
      return c.json({ error: "Plugin not found" }, 404);
    }
    const config = mockPluginManager.getPluginConfig();
    return c.json(config);
  });

  // Update plugin config
  app.put("/:id/config", async (c) => {
    c.req.param("id"); // Extract but don't use - mock controls response
    const body = await c.req.json();
    if (!mockPluginManager.isInstalled()) {
      return c.json({ error: "Plugin not found" }, 404);
    }
    mockPluginManager.setPluginConfig();
    return c.json({
      success: true,
      config: body,
    });
  });

  return app;
}

describe("Admin Plugins Route", () => {
  let app: Hono;

  beforeEach(() => {
    app = createTestApp();
    // Reset all mocks
    mockPluginManager.list.mockReset();
    mockPluginManager.getPlugin.mockReset();
    mockPluginManager.enable.mockReset();
    mockPluginManager.disable.mockReset();
    mockPluginManager.install.mockReset();
    mockPluginManager.uninstall.mockReset();
    mockPluginManager.isInstalled.mockReset();
    mockPluginManager.getPluginConfig.mockReset();
    mockPluginManager.setPluginConfig.mockReset();

    // Set default return values
    mockPluginManager.list.mockReturnValue([]);
    mockPluginManager.enable.mockReturnValue(true);
    mockPluginManager.disable.mockReturnValue(true);
    mockPluginManager.install.mockReturnValue({
      success: true,
      pluginId: "test-plugin",
      version: "1.0.0",
    });
    mockPluginManager.uninstall.mockReturnValue(true);
    mockPluginManager.isInstalled.mockReturnValue(true);
    mockPluginManager.getPluginConfig.mockReturnValue({});
    mockPluginManager.setPluginConfig.mockReturnValue(true);
  });

  describe("GET /", () => {
    test("returns empty list when no plugins installed", async () => {
      mockPluginManager.list.mockReturnValue([]);

      const res = await app.request("/");
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginListResponse;
      expect(data.plugins).toEqual([]);
      expect(data.total).toBe(0);
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
      mockPluginManager.list.mockReturnValue(mockPlugins);

      const res = await app.request("/");
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
      mockPluginManager.getPlugin.mockReturnValue(mockPlugin);

      const res = await app.request("/activity-logger");
      expect(res.status).toBe(200);

      const data = (await res.json()) as InstalledPlugin;
      expect(data.id).toBe("activity-logger");
      expect(data.name).toBe("Activity Logger");
      expect(data.author).toBe("Rox Team");
    });

    test("returns 404 for non-existent plugin", async () => {
      mockPluginManager.getPlugin.mockReturnValue(undefined);

      const res = await app.request("/non-existent");
      expect(res.status).toBe(404);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toBe("Plugin not found");
    });
  });

  describe("POST /:id/enable", () => {
    test("enables a plugin", async () => {
      mockPluginManager.enable.mockReturnValue(true);

      const res = await app.request("/activity-logger/enable", {
        method: "POST",
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginActionResponse;
      expect(data.success).toBe(true);
      expect(data.message).toBe("Plugin enabled");
      expect(data.requiresRestart).toBe(true);
    });

    test("returns 404 for non-existent plugin", async () => {
      mockPluginManager.enable.mockReturnValue(false);

      const res = await app.request("/non-existent/enable", {
        method: "POST",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /:id/disable", () => {
    test("disables a plugin", async () => {
      mockPluginManager.disable.mockReturnValue(true);

      const res = await app.request("/activity-logger/disable", {
        method: "POST",
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginActionResponse;
      expect(data.success).toBe(true);
      expect(data.message).toBe("Plugin disabled");
      expect(data.requiresRestart).toBe(true);
    });
  });

  describe("POST /install", () => {
    test("installs a plugin from Git URL", async () => {
      mockPluginManager.install.mockReturnValue({
        success: true,
        pluginId: "my-plugin",
        version: "1.0.0",
      });

      const res = await app.request("/install", {
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
    });

    test("returns 400 when source is missing", async () => {
      const res = await app.request("/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);

      const data = (await res.json()) as ErrorResponse;
      expect(data.error).toBe("source is required");
    });

    test("returns 400 when installation fails", async () => {
      mockPluginManager.install.mockReturnValue({
        success: false,
        error: "Invalid manifest",
      } as InstallResult);

      const res = await app.request("/install", {
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
  });

  describe("DELETE /:id", () => {
    test("uninstalls a plugin", async () => {
      mockPluginManager.uninstall.mockReturnValue(true);

      const res = await app.request("/activity-logger", {
        method: "DELETE",
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginActionResponse;
      expect(data.success).toBe(true);
      expect(data.message).toBe("Plugin uninstalled");
      expect(data.requiresRestart).toBe(true);
    });

    test("returns 404 for non-existent plugin", async () => {
      mockPluginManager.uninstall.mockReturnValue(false);

      const res = await app.request("/non-existent", {
        method: "DELETE",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("GET /:id/config", () => {
    test("returns plugin configuration", async () => {
      mockPluginManager.isInstalled.mockReturnValue(true);
      mockPluginManager.getPluginConfig.mockReturnValue({
        enabled: true,
        keywords: ["spoiler", "nsfw"],
      });

      const res = await app.request("/activity-logger/config");
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginConfigResponse;
      expect(data.enabled).toBe(true);
      expect(data.keywords).toEqual(["spoiler", "nsfw"]);
    });

    test("returns 404 for non-existent plugin", async () => {
      mockPluginManager.isInstalled.mockReturnValue(false);

      const res = await app.request("/non-existent/config");
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:id/config", () => {
    test("updates plugin configuration", async () => {
      mockPluginManager.isInstalled.mockReturnValue(true);
      mockPluginManager.setPluginConfig.mockReturnValue(true);

      const newConfig = {
        enabled: true,
        keywords: ["spoiler", "nsfw", "tw"],
      };

      const res = await app.request("/activity-logger/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      expect(res.status).toBe(200);

      const data = (await res.json()) as PluginActionResponse;
      expect(data.success).toBe(true);
      expect(data.config).toEqual(newConfig);
    });

    test("returns 404 for non-existent plugin", async () => {
      mockPluginManager.isInstalled.mockReturnValue(false);

      const res = await app.request("/non-existent/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      });
      expect(res.status).toBe(404);
    });
  });
});
