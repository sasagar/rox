/**
 * Admin Plugin Management Routes
 *
 * Provides administrative endpoints for managing plugins.
 * All endpoints require admin authentication.
 *
 * @module routes/admin-plugins
 */

import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth.js";
import { errorResponse } from "../lib/routeUtils.js";
import { PluginManager } from "../plugins/PluginManager.js";
import type { PluginLoader } from "../plugins/PluginLoader.js";
import type { PluginSource } from "shared";

// Plugin directory from environment
const PLUGIN_DIR = process.env.PLUGIN_DIRECTORY || "./plugins";

// Initialize plugin manager for file-based operations
const pluginManager = new PluginManager(PLUGIN_DIR);

/**
 * Reference to the runtime plugin loader
 * Set via setPluginLoader() after initialization
 */
let runtimePluginLoader: PluginLoader | null = null;

/**
 * Set the plugin loader instance for hot reload functionality
 *
 * @param loader - The PluginLoader instance
 */
export function setPluginLoader(loader: PluginLoader): void {
  runtimePluginLoader = loader;
}

const app = new Hono();

// All plugin admin routes require admin authentication
app.use("/*", requireAdmin());

// ============================================================================
// Plugin List and Info Endpoints
// ============================================================================

/**
 * List All Plugins
 *
 * GET /api/admin/plugins
 *
 * Returns a list of all installed plugins with their status.
 *
 * Response (200):
 * ```json
 * {
 *   "plugins": [
 *     {
 *       "id": "activity-logger",
 *       "name": "Activity Logger",
 *       "version": "1.0.0",
 *       "description": "Logs all note activity",
 *       "enabled": true,
 *       "hasBackend": true,
 *       "hasFrontend": false,
 *       "source": "./plugins/activity-logger"
 *     }
 *   ],
 *   "total": 1
 * }
 * ```
 */
app.get("/", async (c) => {
  const plugins = pluginManager.list();
  return c.json({ plugins, total: plugins.length });
});

/**
 * Get Plugin Details
 *
 * GET /api/admin/plugins/:id
 *
 * Returns detailed information about a specific plugin.
 *
 * Response (200):
 * ```json
 * {
 *   "id": "activity-logger",
 *   "name": "Activity Logger",
 *   "version": "1.0.0",
 *   "description": "Logs all note activity",
 *   "author": "Rox Team",
 *   "license": "MIT",
 *   "enabled": true,
 *   "permissions": ["note:read"],
 *   "backend": "index.ts",
 *   "frontend": null,
 *   "installedAt": "2024-01-01T00:00:00.000Z",
 *   "source": "./plugins/activity-logger"
 * }
 * ```
 */
app.get("/:id", async (c) => {
  const pluginId = c.req.param("id");

  const plugin = pluginManager.getPlugin(pluginId);
  if (!plugin) {
    return errorResponse(c, "Plugin not found", 404);
  }

  return c.json(plugin);
});

// ============================================================================
// Plugin Enable/Disable Endpoints
// ============================================================================

/**
 * Enable Plugin
 *
 * POST /api/admin/plugins/:id/enable
 *
 * Enables a disabled plugin.
 *
 * Response (200):
 * ```json
 * {
 *   "success": true,
 *   "message": "Plugin enabled",
 *   "requiresRestart": true
 * }
 * ```
 */
app.post("/:id/enable", async (c) => {
  const pluginId = c.req.param("id");

  const success = pluginManager.enable(pluginId);
  if (!success) {
    return errorResponse(c, "Plugin not found", 404);
  }

  return c.json({
    success: true,
    message: "Plugin enabled",
    requiresRestart: true, // Plugins require restart to apply changes
  });
});

/**
 * Disable Plugin
 *
 * POST /api/admin/plugins/:id/disable
 *
 * Disables an enabled plugin.
 *
 * Response (200):
 * ```json
 * {
 *   "success": true,
 *   "message": "Plugin disabled",
 *   "requiresRestart": true
 * }
 * ```
 */
app.post("/:id/disable", async (c) => {
  const pluginId = c.req.param("id");

  const success = pluginManager.disable(pluginId);
  if (!success) {
    return errorResponse(c, "Plugin not found", 404);
  }

  return c.json({
    success: true,
    message: "Plugin disabled",
    requiresRestart: true,
  });
});

// ============================================================================
// Plugin Installation Endpoints
// ============================================================================

/**
 * Install Plugin
 *
 * POST /api/admin/plugins/install
 *
 * Installs a new plugin from a Git URL or local path.
 *
 * Request Body:
 * ```json
 * {
 *   "source": "https://github.com/user/my-rox-plugin",
 *   "force": false
 * }
 * ```
 *
 * Response (201):
 * ```json
 * {
 *   "success": true,
 *   "pluginId": "my-plugin",
 *   "version": "1.0.0",
 *   "requiresRestart": true
 * }
 * ```
 */
app.post("/install", async (c) => {
  const body = await c.req.json<{
    source: string;
    force?: boolean;
  }>();

  if (!body.source) {
    return errorResponse(c, "source is required");
  }

  // Determine source type
  let pluginSource: PluginSource;
  if (
    body.source.startsWith("http://") ||
    body.source.startsWith("https://") ||
    body.source.startsWith("git@")
  ) {
    pluginSource = { type: "git", url: body.source };
  } else if (body.source.includes("/") || body.source.startsWith(".")) {
    pluginSource = { type: "local", path: body.source };
  } else {
    pluginSource = { type: "registry", name: body.source };
  }

  const result = await pluginManager.install(pluginSource, {
    force: body.force,
    enable: true,
  });

  if (!result.success) {
    return errorResponse(c, result.error || "Installation failed");
  }

  return c.json(
    {
      success: true,
      pluginId: result.pluginId,
      version: result.version,
      warnings: result.warnings,
      requiresRestart: true,
    },
    201
  );
});

/**
 * Uninstall Plugin
 *
 * DELETE /api/admin/plugins/:id
 *
 * Uninstalls a plugin.
 *
 * Query Parameters:
 * - keepFiles: If "true", keeps plugin files on disk
 *
 * Response (200):
 * ```json
 * {
 *   "success": true,
 *   "message": "Plugin uninstalled",
 *   "requiresRestart": true
 * }
 * ```
 */
app.delete("/:id", async (c) => {
  const pluginId = c.req.param("id");
  const keepFiles = c.req.query("keepFiles") === "true";

  const success = await pluginManager.uninstall(pluginId, { keepFiles });
  if (!success) {
    return errorResponse(c, "Plugin not found or failed to uninstall", 404);
  }

  return c.json({
    success: true,
    message: "Plugin uninstalled",
    requiresRestart: true,
  });
});

// ============================================================================
// Plugin Configuration Endpoints
// ============================================================================

/**
 * Get Plugin Configuration
 *
 * GET /api/admin/plugins/:id/config
 *
 * Returns the configuration for a specific plugin.
 *
 * Response (200):
 * ```json
 * {
 *   "enabled": true,
 *   "keywords": ["spoiler", "nsfw"]
 * }
 * ```
 */
app.get("/:id/config", async (c) => {
  const pluginId = c.req.param("id");

  if (!pluginManager.isInstalled(pluginId)) {
    return errorResponse(c, "Plugin not found", 404);
  }

  const config = pluginManager.getPluginConfig(pluginId);
  return c.json(config);
});

/**
 * Update Plugin Configuration
 *
 * PUT /api/admin/plugins/:id/config
 *
 * Updates the configuration for a specific plugin.
 *
 * Request Body:
 * ```json
 * {
 *   "enabled": true,
 *   "keywords": ["spoiler", "nsfw", "tw"]
 * }
 * ```
 *
 * Response (200):
 * ```json
 * {
 *   "success": true,
 *   "config": {
 *     "enabled": true,
 *     "keywords": ["spoiler", "nsfw", "tw"]
 *   }
 * }
 * ```
 */
app.put("/:id/config", async (c) => {
  const pluginId = c.req.param("id");
  const body = await c.req.json();

  if (!pluginManager.isInstalled(pluginId)) {
    return errorResponse(c, "Plugin not found", 404);
  }

  pluginManager.setPluginConfig(pluginId, body);

  return c.json({
    success: true,
    config: body,
  });
});

// ============================================================================
// Plugin Hot Reload Endpoints (Development Only)
// ============================================================================

/**
 * Reload Plugin
 *
 * POST /api/admin/plugins/:id/reload
 *
 * Hot reloads a plugin without restarting the server.
 * This is useful during plugin development.
 * Only available when pluginLoader is set in context.
 *
 * Response (200):
 * ```json
 * {
 *   "success": true,
 *   "pluginId": "my-plugin",
 *   "message": "Plugin reloaded successfully"
 * }
 * ```
 *
 * Response (503) when hot reload is not available:
 * ```json
 * {
 *   "success": false,
 *   "error": "Hot reload not available"
 * }
 * ```
 */
app.post("/:id/reload", async (c) => {
  const pluginId = c.req.param("id");

  if (!runtimePluginLoader) {
    return errorResponse(
      c,
      "Hot reload not available. Plugin loader not configured.",
      503
    );
  }

  if (!pluginManager.isInstalled(pluginId)) {
    return errorResponse(c, "Plugin not found", 404);
  }

  const result = await runtimePluginLoader.reloadPlugin(pluginId);

  if (!result.success) {
    return errorResponse(c, result.error || "Failed to reload plugin");
  }

  return c.json({
    success: true,
    pluginId: result.pluginId,
    message: "Plugin reloaded successfully",
  });
});

/**
 * Reload All Plugins
 *
 * POST /api/admin/plugins/reload-all
 *
 * Hot reloads all loaded plugins without restarting the server.
 * Only available when pluginLoader is set in context.
 *
 * Response (200):
 * ```json
 * {
 *   "success": true,
 *   "results": [
 *     { "pluginId": "plugin-a", "success": true },
 *     { "pluginId": "plugin-b", "success": false, "error": "..." }
 *   ],
 *   "reloadedCount": 1,
 *   "failedCount": 1
 * }
 * ```
 */
app.post("/reload-all", async (c) => {
  if (!runtimePluginLoader) {
    return errorResponse(
      c,
      "Hot reload not available. Plugin loader not configured.",
      503
    );
  }

  const loadedPlugins = runtimePluginLoader.getLoadedPlugins();
  const results: Array<{ pluginId: string; success: boolean; error?: string }> = [];

  for (const pluginId of loadedPlugins) {
    const result = await runtimePluginLoader.reloadPlugin(pluginId);
    results.push({
      pluginId,
      success: result.success,
      error: result.error,
    });
  }

  const reloadedCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;

  return c.json({
    success: failedCount === 0,
    results,
    reloadedCount,
    failedCount,
  });
});

export default app;
