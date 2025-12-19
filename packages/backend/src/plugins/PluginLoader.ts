/**
 * Plugin Loader
 *
 * Discovers, loads, and manages Rox plugins.
 * Plugins can extend functionality through lifecycle events, custom routes,
 * and middleware.
 *
 * @module plugins/PluginLoader
 */

import { readdir, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import type { Hono } from "hono";
import type pino from "pino";
import type { IEventBus } from "../interfaces/IEventBus.js";
import { logger as rootLogger } from "../lib/logger.js";
import { FilePluginConfigStorage } from "./PluginConfigStorage.js";
import { PluginPermissionManager } from "./PluginPermissions.js";
import { createSecurePluginContext, PluginSecurityAuditor } from "./SecurePluginContext.js";
import type {
  RoxPlugin,
  PluginContext,
  LoadedPlugin,
  PluginManifest,
  PluginLoaderOptions,
  PluginLoadResult,
  ScheduledTask,
} from "./types/plugin.js";

/**
 * Default plugin directory
 */
const DEFAULT_PLUGIN_DIR = "./plugins";

/**
 * Default config directory for plugin data
 */
const DEFAULT_CONFIG_DIR = "./data/plugins";

/**
 * Plugin Loader
 *
 * Manages the lifecycle of plugins in the Rox system.
 * Handles discovery, loading, unloading, and provides plugin contexts.
 *
 * @example
 * ```ts
 * const loader = new PluginLoader(eventBus, app, {
 *   pluginDirectory: './plugins'
 * });
 *
 * // Load all plugins from directory
 * await loader.loadFromDirectory();
 *
 * // Load a specific plugin
 * await loader.loadPlugin('./plugins/my-plugin');
 *
 * // Get loaded plugins
 * const plugins = loader.getPlugins();
 * ```
 */
export class PluginLoader {
  private plugins: Map<string, LoadedPlugin> = new Map();
  private scheduledTasks: Map<string, NodeJS.Timeout[]> = new Map();
  private logger: pino.Logger;
  private pluginDirectory: string;
  private configDirectory: string;
  private loadTimeout: number;
  private roxVersion: string;
  private baseUrl: string;
  private permissionManager: PluginPermissionManager;
  private securityAuditor: PluginSecurityAuditor;

  /**
   * Create a new PluginLoader instance
   *
   * @param eventBus - Event bus for plugin event subscriptions
   * @param app - Hono application for route registration
   * @param options - Loader configuration options
   */
  constructor(
    private eventBus: IEventBus,
    private app: Hono,
    options: PluginLoaderOptions & { roxVersion?: string; baseUrl?: string } = {},
  ) {
    this.logger = rootLogger.child({ module: "PluginLoader" });
    this.pluginDirectory = options.pluginDirectory ?? DEFAULT_PLUGIN_DIR;
    this.configDirectory = DEFAULT_CONFIG_DIR;
    this.loadTimeout = options.loadTimeout ?? 30000;
    this.roxVersion = options.roxVersion ?? "0.0.0";
    this.baseUrl = options.baseUrl ?? process.env.URL ?? "http://localhost:3000";
    this.permissionManager = new PluginPermissionManager(this.logger);
    this.securityAuditor = new PluginSecurityAuditor(this.logger);
  }

  /**
   * Load all plugins from the configured directory
   *
   * @returns Array of load results for each plugin
   */
  async loadFromDirectory(): Promise<PluginLoadResult[]> {
    const results: PluginLoadResult[] = [];

    try {
      const dirStat = await stat(this.pluginDirectory).catch(() => null);
      if (!dirStat?.isDirectory()) {
        this.logger.info(
          { directory: this.pluginDirectory },
          "Plugin directory does not exist, skipping plugin loading",
        );
        return results;
      }

      const entries = await readdir(this.pluginDirectory, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = join(this.pluginDirectory, entry.name);
          const result = await this.loadPlugin(pluginPath);
          results.push(result);
        }
      }
    } catch (error) {
      this.logger.error({ err: error }, "Failed to read plugin directory");
    }

    return results;
  }

  /**
   * Load a single plugin from a directory path
   *
   * @param pluginPath - Path to the plugin directory
   * @returns Load result
   */
  async loadPlugin(pluginPath: string): Promise<PluginLoadResult> {
    let pluginId = "unknown";

    try {
      // Try to load plugin manifest
      const manifest = await this.loadManifest(pluginPath);
      if (manifest) {
        pluginId = manifest.id;

        // Check version compatibility
        if (manifest.minRoxVersion && !this.isVersionCompatible(manifest.minRoxVersion)) {
          return {
            success: false,
            pluginId,
            error: `Plugin requires Rox ${manifest.minRoxVersion} or higher`,
          };
        }
      }

      // Load the plugin module
      const plugin = await this.loadPluginModule(pluginPath, manifest);
      if (!plugin) {
        return {
          success: false,
          pluginId,
          error: "Failed to load plugin module",
        };
      }

      pluginId = plugin.id;

      // Check if already loaded
      if (this.plugins.has(pluginId)) {
        return {
          success: false,
          pluginId,
          error: "Plugin is already loaded",
        };
      }

      // Check dependencies
      if (plugin.dependencies) {
        for (const dep of plugin.dependencies) {
          if (!this.plugins.has(dep)) {
            return {
              success: false,
              pluginId,
              error: `Missing dependency: ${dep}`,
            };
          }
        }
      }

      // Validate and register plugin permissions
      const permissions = manifest?.permissions ?? [];
      const permissionValidation = this.permissionManager.validateManifestPermissions(
        manifest ?? { id: pluginId, name: plugin.name, version: plugin.version, permissions },
      );

      if (!permissionValidation.valid) {
        this.securityAuditor.log(pluginId, "load_rejected", false, undefined, {
          reason: "invalid_permissions",
          errors: permissionValidation.errors,
        });
        return {
          success: false,
          pluginId,
          error: `Invalid permissions: ${permissionValidation.errors.join(", ")}`,
        };
      }

      // Log high-risk permissions
      if (permissionValidation.highRiskPermissions.length > 0) {
        this.logger.warn(
          { pluginId, highRiskPermissions: permissionValidation.highRiskPermissions },
          "Plugin requests high-risk permissions",
        );
        this.securityAuditor.log(pluginId, "high_risk_permissions", true, undefined, {
          permissions: permissionValidation.highRiskPermissions,
        });
      }

      // Register plugin permissions
      this.permissionManager.registerPlugin(pluginId, permissions);

      // Create secure plugin context with permission enforcement
      const context = this.createPluginContext(pluginId, manifest);

      // Initialize the plugin
      const loadedPlugin: LoadedPlugin = {
        plugin,
        context,
        enabled: true,
        unsubscribes: [],
        taskCleanups: [],
      };

      // Call onLoad if defined
      if (plugin.onLoad) {
        await Promise.race([
          plugin.onLoad(context),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Plugin load timeout")), this.loadTimeout),
          ),
        ]);
      }

      // Register routes if defined
      if (plugin.routes) {
        this.registerPluginRoutes(plugin, loadedPlugin);
      }

      // Register middleware if defined
      if (plugin.middleware) {
        for (const mw of plugin.middleware) {
          this.app.use("*", mw);
        }
      }

      this.plugins.set(pluginId, loadedPlugin);

      this.securityAuditor.log(pluginId, "loaded", true, undefined, {
        version: plugin.version,
        permissions,
      });
      this.logger.info(
        { pluginId, version: plugin.version },
        "Plugin loaded successfully",
      );

      return { success: true, pluginId };
    } catch (error) {
      this.securityAuditor.log(pluginId, "load_failed", false, undefined, {
        error: error instanceof Error ? error.message : String(error),
      });
      this.logger.error(
        { err: error, pluginId, pluginPath },
        "Failed to load plugin",
      );
      return {
        success: false,
        pluginId,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Unload a plugin by ID
   *
   * @param pluginId - Plugin identifier
   */
  async unloadPlugin(pluginId: string): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginId);
    if (!loadedPlugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    // Call onUnload if defined
    if (loadedPlugin.plugin.onUnload) {
      try {
        await loadedPlugin.plugin.onUnload();
      } catch (error) {
        this.logger.error(
          { err: error, pluginId },
          "Error during plugin unload",
        );
      }
    }

    // Cleanup event subscriptions
    for (const unsubscribe of loadedPlugin.unsubscribes) {
      unsubscribe();
    }

    // Cleanup scheduled tasks
    for (const cleanup of loadedPlugin.taskCleanups) {
      cleanup();
    }

    // Clear scheduled task intervals
    const taskIntervals = this.scheduledTasks.get(pluginId);
    if (taskIntervals) {
      for (const interval of taskIntervals) {
        clearInterval(interval);
      }
      this.scheduledTasks.delete(pluginId);
    }

    // Unregister plugin permissions
    this.permissionManager.unregisterPlugin(pluginId);

    this.plugins.delete(pluginId);

    this.securityAuditor.log(pluginId, "unloaded", true);
    this.logger.info({ pluginId }, "Plugin unloaded");
  }

  /**
   * Get all loaded plugins
   */
  getPlugins(): RoxPlugin[] {
    return Array.from(this.plugins.values()).map((lp) => lp.plugin);
  }

  /**
   * Get a specific loaded plugin by ID
   */
  getPlugin(pluginId: string): RoxPlugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  /**
   * Check if a plugin is loaded
   */
  isPluginLoaded(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Get the permission manager instance
   *
   * Useful for checking plugin permissions from other parts of the system.
   */
  getPermissionManager(): PluginPermissionManager {
    return this.permissionManager;
  }

  /**
   * Get the security auditor instance
   *
   * Useful for retrieving security audit logs.
   */
  getSecurityAuditor(): PluginSecurityAuditor {
    return this.securityAuditor;
  }

  /**
   * Enable or disable a plugin
   */
  async setEnabled(pluginId: string, enabled: boolean): Promise<void> {
    const loadedPlugin = this.plugins.get(pluginId);
    if (!loadedPlugin) {
      throw new Error(`Plugin not found: ${pluginId}`);
    }

    loadedPlugin.enabled = enabled;
    this.logger.info({ pluginId, enabled }, "Plugin enabled state changed");
  }

  /**
   * Unload all plugins
   */
  async unloadAll(): Promise<void> {
    const pluginIds = Array.from(this.plugins.keys());

    // Unload in reverse order (to handle dependencies)
    for (const pluginId of pluginIds.reverse()) {
      await this.unloadPlugin(pluginId);
    }
  }

  /**
   * Load plugin manifest from plugin.json
   */
  private async loadManifest(pluginPath: string): Promise<PluginManifest | null> {
    try {
      const manifestPath = join(pluginPath, "plugin.json");
      const content = await readFile(manifestPath, "utf-8");
      return JSON.parse(content) as PluginManifest;
    } catch {
      // Manifest is optional
      return null;
    }
  }

  /**
   * Load plugin module from directory
   */
  private async loadPluginModule(
    pluginPath: string,
    manifest: PluginManifest | null,
  ): Promise<RoxPlugin | null> {
    // Determine entry point
    const entryPoints = [
      manifest?.backend,
      "index.ts",
      "index.js",
      "backend/index.ts",
      "backend/index.js",
    ].filter(Boolean) as string[];

    for (const entry of entryPoints) {
      try {
        const modulePath = join(pluginPath, entry);
        const moduleStat = await stat(modulePath).catch(() => null);

        if (moduleStat?.isFile()) {
          // Dynamic import
          const module = await import(modulePath);
          const plugin = module.default as RoxPlugin;

          if (this.isValidPlugin(plugin)) {
            return plugin;
          }
        }
      } catch (error) {
        this.logger.debug(
          { err: error, pluginPath, entry },
          "Failed to load entry point",
        );
      }
    }

    return null;
  }

  /**
   * Validate that an object is a valid RoxPlugin
   */
  private isValidPlugin(obj: unknown): obj is RoxPlugin {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const plugin = obj as RoxPlugin;
    return (
      typeof plugin.id === "string" &&
      typeof plugin.name === "string" &&
      typeof plugin.version === "string"
    );
  }

  /**
   * Create a plugin context with permission enforcement
   *
   * @param pluginId - Plugin identifier
   * @param manifest - Optional plugin manifest with permissions
   */
  private createPluginContext(pluginId: string, manifest?: PluginManifest | null): PluginContext {
    const pluginLogger = rootLogger.child({ plugin: pluginId });
    const configStorage = new FilePluginConfigStorage(pluginId, this.configDirectory);
    const taskIntervals: NodeJS.Timeout[] = [];
    this.scheduledTasks.set(pluginId, taskIntervals);

    const onRegisterTask = (task: ScheduledTask) => {
      const interval =
        typeof task.schedule === "number"
          ? task.schedule
          : this.parseCronInterval(task.schedule);

      if (task.runOnStartup) {
        // Run immediately
        Promise.resolve(task.handler()).catch((err) => {
          pluginLogger.error({ err, taskId: task.id }, "Scheduled task failed");
        });
      }

      // Set up recurring execution
      const intervalId = setInterval(() => {
        Promise.resolve(task.handler()).catch((err) => {
          pluginLogger.error({ err, taskId: task.id }, "Scheduled task failed");
        });
      }, interval);

      taskIntervals.push(intervalId);

      pluginLogger.debug(
        { taskId: task.id, interval },
        "Registered scheduled task",
      );
    };

    // If manifest declares permissions, create a secure context
    if (manifest?.permissions && manifest.permissions.length > 0) {
      return createSecurePluginContext({
        pluginId,
        events: this.eventBus,
        logger: pluginLogger,
        config: configStorage,
        baseUrl: this.baseUrl,
        roxVersion: this.roxVersion,
        permissionManager: this.permissionManager,
        onRegisterTask,
      });
    }

    // Fallback to basic context for plugins without manifest permissions
    // (backward compatibility, but logs a warning)
    this.logger.warn(
      { pluginId },
      "Plugin loaded without permission manifest - using unrestricted context",
    );

    return {
      events: this.eventBus,
      logger: pluginLogger,
      config: configStorage,
      baseUrl: this.baseUrl,
      roxVersion: this.roxVersion,
      registerScheduledTask: onRegisterTask,
    };
  }

  /**
   * Parse a simple cron-like interval string
   * Supports: "1m", "5m", "1h", "24h"
   */
  private parseCronInterval(schedule: string): number {
    const match = schedule.match(/^(\d+)(s|m|h|d)$/);
    if (!match || !match[1] || !match[2]) {
      throw new Error(`Invalid schedule format: ${schedule}`);
    }

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        throw new Error(`Invalid schedule unit: ${unit}`);
    }
  }

  /**
   * Register plugin routes under /api/x/{pluginId}/
   */
  private registerPluginRoutes(plugin: RoxPlugin, _loadedPlugin: LoadedPlugin): void {
    const routePrefix = `/api/x/${plugin.id}`;

    // Create a sub-app for the plugin
    const pluginApp = new (this.app.constructor as typeof Hono)();

    // Call the plugin's routes function
    plugin.routes!(pluginApp);

    // Mount the plugin app under the prefix
    this.app.route(routePrefix, pluginApp);

    this.logger.debug(
      { pluginId: plugin.id, routePrefix },
      "Registered plugin routes",
    );
  }

  /**
   * Check if Rox version is compatible with plugin requirement
   */
  private isVersionCompatible(minVersion: string): boolean {
    // Simple version comparison (assumes CalVer YYYY.MM.patch format)
    const current = this.parseVersion(this.roxVersion);
    const required = this.parseVersion(minVersion);

    if (!current || !required) {
      // If we can't parse, assume compatible
      return true;
    }

    // Compare year, month, then patch
    if (current.year > required.year) return true;
    if (current.year < required.year) return false;
    if (current.month > required.month) return true;
    if (current.month < required.month) return false;
    return current.patch >= required.patch;
  }

  /**
   * Parse a CalVer version string
   */
  private parseVersion(version: string): { year: number; month: number; patch: number } | null {
    const match = version.match(/^(\d{4})\.(\d{1,2})\.(\d+)/);
    if (!match || !match[1] || !match[2] || !match[3]) return null;

    return {
      year: parseInt(match[1], 10),
      month: parseInt(match[2], 10),
      patch: parseInt(match[3], 10),
    };
  }
}
