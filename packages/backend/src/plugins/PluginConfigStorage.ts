/**
 * Plugin Configuration Storage
 *
 * Provides persistent storage for plugin-specific configuration.
 * Configuration is stored in a JSON file in the plugins directory.
 *
 * @module plugins/PluginConfigStorage
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import type { PluginConfigStorage } from "./types/plugin.js";
import { isValidPluginId } from "shared";

/**
 * File-based Plugin Configuration Storage
 *
 * Stores plugin configuration in a JSON file.
 * Each plugin has its own configuration file.
 */
export class FilePluginConfigStorage implements PluginConfigStorage {
  private configPath: string;
  private cache: Record<string, unknown> | null = null;
  private writePromise: Promise<void> | null = null;

  /**
   * Create a new plugin config storage instance
   *
   * @param pluginId - Plugin identifier (used for filename)
   * @param baseDir - Base directory for config files (default: ./data/plugins)
   * @throws Error if pluginId is invalid (prevents path traversal attacks)
   */
  constructor(pluginId: string, baseDir: string = "./data/plugins") {
    // Validate plugin ID to prevent path traversal attacks
    // (e.g., "../../../etc/passwd" or "foo/../../bar")
    if (!isValidPluginId(pluginId)) {
      throw new Error(`Invalid plugin ID: ${pluginId}`);
    }

    const resolvedBase = resolve(baseDir);
    this.configPath = join(resolvedBase, `${pluginId}.config.json`);

    // Additional safety check: ensure the resolved path is within baseDir
    const resolvedConfig = resolve(this.configPath);
    if (!resolvedConfig.startsWith(resolvedBase)) {
      throw new Error(`Path traversal detected: ${pluginId}`);
    }
  }

  /**
   * Get a configuration value
   */
  async get<T>(key: string): Promise<T | undefined> {
    const config = await this.loadConfig();
    return config[key] as T | undefined;
  }

  /**
   * Set a configuration value
   */
  async set<T>(key: string, value: T): Promise<void> {
    const config = await this.loadConfig();
    config[key] = value;
    await this.saveConfig(config);
  }

  /**
   * Delete a configuration value
   */
  async delete(key: string): Promise<void> {
    const config = await this.loadConfig();
    delete config[key];
    await this.saveConfig(config);
  }

  /**
   * Get all configuration values
   */
  async getAll(): Promise<Record<string, unknown>> {
    return { ...(await this.loadConfig()) };
  }

  /**
   * Load configuration from file
   */
  private async loadConfig(): Promise<Record<string, unknown>> {
    if (this.cache !== null) {
      return this.cache;
    }

    try {
      const content = await readFile(this.configPath, "utf-8");
      this.cache = JSON.parse(content) as Record<string, unknown>;
      return this.cache;
    } catch (error) {
      // File doesn't exist or is invalid, start with empty config
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.cache = {};
        return this.cache;
      }
      throw error;
    }
  }

  /**
   * Save configuration to file
   */
  private async saveConfig(config: Record<string, unknown>): Promise<void> {
    this.cache = config;

    // Wait for any pending write to complete
    if (this.writePromise) {
      await this.writePromise;
    }

    this.writePromise = this.doSaveConfig(config);
    await this.writePromise;
    this.writePromise = null;
  }

  /**
   * Actually write the config to disk
   */
  private async doSaveConfig(config: Record<string, unknown>): Promise<void> {
    // Ensure directory exists
    await mkdir(dirname(this.configPath), { recursive: true });

    // Write config file
    await writeFile(this.configPath, JSON.stringify(config, null, 2), "utf-8");
  }
}

/**
 * In-memory Plugin Configuration Storage
 *
 * Stores plugin configuration in memory only.
 * Useful for testing or temporary plugins.
 */
export class InMemoryPluginConfigStorage implements PluginConfigStorage {
  private config: Record<string, unknown> = {};

  async get<T>(key: string): Promise<T | undefined> {
    return this.config[key] as T | undefined;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.config[key] = value;
  }

  async delete(key: string): Promise<void> {
    delete this.config[key];
  }

  async getAll(): Promise<Record<string, unknown>> {
    return { ...this.config };
  }
}
