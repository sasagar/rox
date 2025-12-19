/**
 * Plugin Types for Rox Plugin System
 *
 * This module defines the core interfaces for creating and managing plugins.
 * Plugins can extend Rox functionality by subscribing to lifecycle events,
 * registering custom routes, and adding ActivityPub handlers.
 *
 * @module plugins/types/plugin
 */

import type { Hono } from "hono";
import type { MiddlewareHandler } from "hono/types";
import type pino from "pino";
import type { IEventBus } from "../../interfaces/IEventBus.js";

/**
 * Plugin Configuration Storage Interface
 *
 * Provides persistent storage for plugin-specific configuration.
 * Each plugin has its own isolated configuration namespace.
 *
 * @example
 * ```ts
 * // Get configuration value
 * const keywords = await config.get<string[]>('keywords') ?? [];
 *
 * // Set configuration value
 * await config.set('keywords', ['sensitive', 'nsfw']);
 *
 * // Delete configuration value
 * await config.delete('keywords');
 * ```
 */
export interface PluginConfigStorage {
  /**
   * Get a configuration value
   *
   * @param key - Configuration key
   * @returns The configuration value or undefined if not set
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Set a configuration value
   *
   * @param key - Configuration key
   * @param value - Configuration value (must be JSON-serializable)
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Delete a configuration value
   *
   * @param key - Configuration key
   */
  delete(key: string): Promise<void>;

  /**
   * Get all configuration values for this plugin
   *
   * @returns Object containing all configuration key-value pairs
   */
  getAll(): Promise<Record<string, unknown>>;
}

/**
 * Scheduled Task Definition
 *
 * Allows plugins to register tasks that run on a schedule.
 */
export interface ScheduledTask {
  /** Unique identifier for this task */
  id: string;

  /** Task name for logging */
  name: string;

  /** Cron expression or interval in milliseconds */
  schedule: string | number;

  /** Task handler function */
  handler: () => Promise<void> | void;

  /** Whether to run immediately on startup */
  runOnStartup?: boolean;
}

/**
 * Plugin Context
 *
 * Provides plugins with access to Rox core services and utilities.
 * This context is passed to the plugin's onLoad function.
 *
 * @example
 * ```ts
 * const myPlugin: RoxPlugin = {
 *   id: 'my-plugin',
 *   name: 'My Plugin',
 *   version: '1.0.0',
 *
 *   onLoad({ events, logger, config }) {
 *     events.on('note:afterCreate', ({ note }) => {
 *       logger.info({ noteId: note.id }, 'Note created');
 *     });
 *   }
 * };
 * ```
 */
export interface PluginContext {
  /** Event bus for subscribing to lifecycle events */
  events: IEventBus;

  /** Logger namespaced to this plugin */
  logger: pino.Logger;

  /** Plugin-specific configuration storage */
  config: PluginConfigStorage;

  /** Register a scheduled task */
  registerScheduledTask(task: ScheduledTask): void;

  /** Base URL of the Rox instance */
  baseUrl: string;

  /** Current Rox version */
  roxVersion: string;
}

/**
 * Plugin Route Registration Options
 */
export interface PluginRouteOptions {
  /** Whether routes require authentication */
  requireAuth?: boolean;

  /** Rate limit for plugin routes (requests per minute) */
  rateLimit?: number;
}

/**
 * Loaded Plugin State
 *
 * Internal state for a loaded plugin instance.
 */
export interface LoadedPlugin {
  /** Plugin definition */
  plugin: RoxPlugin;

  /** Plugin context */
  context: PluginContext;

  /** Whether the plugin is currently enabled */
  enabled: boolean;

  /** Unsubscribe functions for event handlers */
  unsubscribes: Array<() => void>;

  /** Scheduled task cleanup functions */
  taskCleanups: Array<() => void>;

  /** Path to the plugin directory (for hot reload) */
  pluginPath: string;
}

/**
 * Plugin Manifest
 *
 * Metadata about a plugin, typically loaded from plugin.json
 */
export interface PluginManifest {
  /** Unique plugin identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Semantic version */
  version: string;

  /** Plugin description */
  description?: string;

  /** Author name or organization */
  author?: string;

  /** Repository URL */
  repository?: string;

  /** Minimum Rox version required */
  minRoxVersion?: string;

  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[];

  /** Required permissions */
  permissions?: PluginPermission[];

  /** Path to backend entry point */
  backend?: string;

  /** Path to frontend entry point */
  frontend?: string;

  /** Configuration schema (JSON Schema) */
  configSchema?: Record<string, unknown>;
}

/**
 * Plugin Permissions
 *
 * Permissions that plugins can request for accessing various Rox features.
 */
export type PluginPermission =
  | "note:read"
  | "note:write"
  | "user:read"
  | "user:write"
  | "file:read"
  | "file:write"
  | "admin:read"
  | "admin:write"
  | "config:read"
  | "config:write";

/**
 * Rox Plugin Interface
 *
 * The main interface that all plugins must implement.
 * Plugins are loaded during application startup and can extend
 * Rox functionality through lifecycle hooks, routes, and handlers.
 *
 * @example
 * ```ts
 * // Simple logging plugin
 * const loggingPlugin: RoxPlugin = {
 *   id: 'activity-logger',
 *   name: 'Activity Logger',
 *   version: '1.0.0',
 *   description: 'Logs all note and user activity',
 *
 *   onLoad({ events, logger }) {
 *     events.on('note:afterCreate', ({ note }) => {
 *       logger.info({ noteId: note.id }, 'Note created');
 *     });
 *
 *     events.on('user:afterRegister', ({ userId, username }) => {
 *       logger.info({ userId, username }, 'User registered');
 *     });
 *   }
 * };
 *
 * export default loggingPlugin;
 * ```
 *
 * @example
 * ```ts
 * // Content moderation plugin with routes
 * const moderationPlugin: RoxPlugin = {
 *   id: 'auto-moderation',
 *   name: 'Auto Moderation',
 *   version: '1.0.0',
 *
 *   async onLoad({ events, config }) {
 *     events.onBefore('note:beforeCreate', async ({ content }) => {
 *       const blockedWords = await config.get<string[]>('blockedWords') ?? [];
 *       const hasBlocked = blockedWords.some(word =>
 *         content.toLowerCase().includes(word.toLowerCase())
 *       );
 *
 *       if (hasBlocked) {
 *         return { cancel: true, reason: 'Content contains blocked words' };
 *       }
 *       return {};
 *     });
 *   },
 *
 *   routes(app) {
 *     app.get('/config', async (c) => {
 *       // Return current moderation config
 *       return c.json({ status: 'ok' });
 *     });
 *   }
 * };
 * ```
 */
export interface RoxPlugin {
  /** Unique plugin identifier (lowercase, alphanumeric, hyphens) */
  id: string;

  /** Human-readable plugin name */
  name: string;

  /** Semantic version (e.g., "1.0.0") */
  version: string;

  /** Plugin description */
  description?: string;

  /** Minimum Rox version required (e.g., "2025.12.0") */
  minRoxVersion?: string;

  /** Plugin dependencies (other plugin IDs that must be loaded first) */
  dependencies?: string[];

  /**
   * Called when the plugin is loaded
   *
   * Use this to subscribe to events, initialize state, and set up resources.
   * The context provides access to the event bus, logger, and configuration.
   *
   * @param context - Plugin context with access to Rox services
   */
  onLoad?(context: PluginContext): Promise<void> | void;

  /**
   * Called when the plugin is unloaded
   *
   * Use this to clean up resources, close connections, etc.
   * Event subscriptions are automatically cleaned up.
   */
  onUnload?(): Promise<void> | void;

  /**
   * Register custom API routes
   *
   * Routes are registered under `/api/x/{pluginId}/`
   * For example, if your plugin ID is "my-plugin" and you register
   * a route at "/stats", it will be accessible at "/api/x/my-plugin/stats"
   *
   * @param app - Hono app instance scoped to this plugin's route prefix
   * @param options - Route registration options
   */
  routes?(app: Hono, options?: PluginRouteOptions): void;

  /**
   * Register global middleware
   *
   * Middleware registered here runs for all requests.
   * Use sparingly and ensure minimal performance impact.
   */
  middleware?: MiddlewareHandler[];

  /**
   * Admin UI metadata
   *
   * Provides information for the admin panel plugin management interface.
   */
  adminUI?: {
    /** Path to settings component (for frontend plugins) */
    settingsComponent?: string;

    /** Configuration schema for admin UI */
    configSchema?: Record<string, unknown>;
  };
}

/**
 * Plugin Loader Options
 */
export interface PluginLoaderOptions {
  /** Directory to load plugins from */
  pluginDirectory?: string;

  /** Whether to enable hot reloading */
  hotReload?: boolean;

  /** Maximum time to wait for plugin load (ms) */
  loadTimeout?: number;
}

/**
 * Plugin Load Result
 */
export interface PluginLoadResult {
  /** Whether the plugin loaded successfully */
  success: boolean;

  /** Plugin ID */
  pluginId: string;

  /** Error message if load failed */
  error?: string;
}
