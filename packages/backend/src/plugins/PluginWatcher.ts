/**
 * Plugin File Watcher
 *
 * Watches plugin directories for changes and triggers hot reload.
 * Only active in development mode to support plugin development workflow.
 *
 * @module plugins/PluginWatcher
 */

import { watch, type FSWatcher } from "fs";
import type pino from "pino";
import type { PluginLoader } from "./PluginLoader.js";

/**
 * Options for the plugin watcher
 */
export interface PluginWatcherOptions {
  /** Plugin loader instance */
  pluginLoader: PluginLoader;
  /** Logger instance */
  logger: pino.Logger;
  /** Debounce delay in milliseconds */
  debounceMs?: number;
  /** Whether to enable watching (defaults to NODE_ENV !== 'production') */
  enabled?: boolean;
}

/**
 * Plugin File Watcher
 *
 * Monitors plugin directories for file changes and automatically
 * reloads plugins when their source files are modified.
 */
export class PluginWatcher {
  private pluginLoader: PluginLoader;
  private logger: pino.Logger;
  private debounceMs: number;
  private enabled: boolean;
  private watchers: Map<string, FSWatcher> = new Map();
  private debounceTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(options: PluginWatcherOptions) {
    this.pluginLoader = options.pluginLoader;
    this.logger = options.logger.child({ module: "plugin-watcher" });
    this.debounceMs = options.debounceMs ?? 300;
    this.enabled = options.enabled ?? process.env.NODE_ENV !== "production";
  }

  /**
   * Start watching all loaded plugins
   */
  start(): void {
    if (!this.enabled) {
      this.logger.info("Plugin watching disabled (production mode)");
      return;
    }

    const loadedPlugins = this.pluginLoader.getLoadedPlugins();
    this.logger.info(
      { pluginCount: loadedPlugins.length },
      "Starting plugin file watcher"
    );

    for (const pluginId of loadedPlugins) {
      this.watchPlugin(pluginId);
    }
  }

  /**
   * Stop watching all plugins
   */
  stop(): void {
    this.logger.info("Stopping plugin file watcher");

    // Clear all debounce timers
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();

    // Close all watchers
    for (const [pluginId, watcher] of this.watchers) {
      this.logger.debug({ pluginId }, "Closing watcher for plugin");
      watcher.close();
    }
    this.watchers.clear();
  }

  /**
   * Watch a specific plugin for changes
   */
  watchPlugin(pluginId: string): void {
    if (!this.enabled) {
      return;
    }

    const pluginPath = this.pluginLoader.getPluginPath(pluginId);
    if (!pluginPath) {
      this.logger.warn({ pluginId }, "Cannot watch plugin: path not found");
      return;
    }

    // Don't create duplicate watchers
    if (this.watchers.has(pluginId)) {
      return;
    }

    try {
      const watcher = watch(
        pluginPath,
        { recursive: true },
        (eventType, filename) => {
          this.handleFileChange(pluginId, eventType, filename);
        }
      );

      this.watchers.set(pluginId, watcher);
      this.logger.debug({ pluginId, pluginPath }, "Started watching plugin");
    } catch (error) {
      this.logger.error(
        { err: error, pluginId, pluginPath },
        "Failed to start watching plugin"
      );
    }
  }

  /**
   * Stop watching a specific plugin
   */
  unwatchPlugin(pluginId: string): void {
    const watcher = this.watchers.get(pluginId);
    if (watcher) {
      watcher.close();
      this.watchers.delete(pluginId);
      this.logger.debug({ pluginId }, "Stopped watching plugin");
    }

    // Clear any pending debounce timer
    const timer = this.debounceTimers.get(pluginId);
    if (timer) {
      clearTimeout(timer);
      this.debounceTimers.delete(pluginId);
    }
  }

  /**
   * Handle file change events
   */
  private handleFileChange(
    pluginId: string,
    eventType: string,
    filename: string | null
  ): void {
    // Ignore non-source files
    if (filename && !this.isSourceFile(filename)) {
      return;
    }

    this.logger.debug(
      { pluginId, eventType, filename },
      "Detected file change in plugin"
    );

    // Debounce to avoid multiple reloads for rapid changes
    const existingTimer = this.debounceTimers.get(pluginId);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(pluginId);
      this.triggerReload(pluginId);
    }, this.debounceMs);

    this.debounceTimers.set(pluginId, timer);
  }

  /**
   * Check if a file is a source file that should trigger reload
   */
  private isSourceFile(filename: string): boolean {
    const ext = filename.split(".").pop()?.toLowerCase();
    const sourceExtensions = ["ts", "tsx", "js", "jsx", "json"];
    return sourceExtensions.includes(ext ?? "");
  }

  /**
   * Trigger plugin reload
   */
  private async triggerReload(pluginId: string): Promise<void> {
    this.logger.info({ pluginId }, "Hot reloading plugin...");

    try {
      // Stop watching during reload to avoid duplicate events
      this.unwatchPlugin(pluginId);

      const result = await this.pluginLoader.reloadPlugin(pluginId);

      if (result.success) {
        this.logger.info({ pluginId }, "Plugin hot reload successful");
        // Resume watching after successful reload
        this.watchPlugin(pluginId);
      } else {
        this.logger.error(
          { pluginId, error: result.error },
          "Plugin hot reload failed"
        );
        // Still try to resume watching so we can catch fixes
        this.watchPlugin(pluginId);
      }
    } catch (error) {
      this.logger.error({ err: error, pluginId }, "Plugin hot reload error");
      // Try to resume watching
      this.watchPlugin(pluginId);
    }
  }

  /**
   * Check if watcher is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get list of watched plugin IDs
   */
  getWatchedPlugins(): string[] {
    return Array.from(this.watchers.keys());
  }
}
