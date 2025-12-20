/**
 * Shared Plugin Types
 *
 * Type definitions shared between backend and frontend for plugin system.
 * These types define the plugin manifest format and common interfaces.
 */

/**
 * Plugin permission types
 * Defines what resources a plugin can access
 */
export type PluginPermission =
  | "note:read"
  | "note:write"
  | "user:read"
  | "user:write"
  | "config:read"
  | "config:write"
  | "admin:read"
  | "admin:write"
  | "storage:read"
  | "storage:write";

/**
 * Plugin manifest schema (plugin.json)
 * Defines the structure of the plugin package manifest file
 */
export interface PluginManifest {
  /** Unique plugin identifier (lowercase, alphanumeric with hyphens) */
  id: string;

  /** Human-readable plugin name */
  name: string;

  /** Plugin version (semantic versioning) */
  version: string;

  /** Plugin description */
  description?: string;

  /** Plugin author name or organization */
  author?: string;

  /** Plugin license (SPDX identifier) */
  license?: string;

  /** Plugin homepage URL */
  homepage?: string;

  /** Git repository URL */
  repository?: string;

  /** Minimum Rox version required (CalVer format) */
  minRoxVersion?: string;

  /** Maximum Rox version supported (CalVer format) */
  maxRoxVersion?: string;

  /** Required permissions */
  permissions?: PluginPermission[];

  /** Plugin dependencies (other plugin IDs) */
  dependencies?: string[];

  /** Backend entry point (relative path) */
  backend?: string;

  /** Frontend entry point (relative path) */
  frontend?: string;

  /** Configuration schema (JSON Schema format) */
  configSchema?: Record<string, unknown>;

  /** Plugin keywords for search */
  keywords?: string[];

  /** Plugin icon URL or local path */
  icon?: string;

  /** Screenshots for plugin listing */
  screenshots?: string[];
}

/**
 * Installed plugin metadata
 * Extended manifest with installation info
 */
export interface InstalledPlugin extends PluginManifest {
  /** Installation timestamp */
  installedAt: string;

  /** Installation source (git URL, local, or registry) */
  source: string;

  /** Whether the plugin is currently enabled */
  enabled: boolean;

  /** Last update check timestamp */
  lastChecked?: string;

  /** Available update version, if any */
  updateAvailable?: string;
}

/**
 * Plugin installation source types
 */
export type PluginSource =
  | { type: "git"; url: string; ref?: string }
  | { type: "local"; path: string }
  | { type: "registry"; name: string; version?: string };

/**
 * Plugin installation options
 */
export interface PluginInstallOptions {
  /** Force installation even if already installed */
  force?: boolean;

  /** Skip dependency checks */
  skipDependencies?: boolean;

  /** Enable plugin after installation */
  enable?: boolean;

  /** Custom installation directory */
  directory?: string;
}

/**
 * Plugin installation result
 */
export interface PluginInstallResult {
  /** Whether installation succeeded */
  success: boolean;

  /** Installed plugin ID */
  pluginId?: string;

  /** Error message if installation failed */
  error?: string;

  /** Warning messages */
  warnings?: string[];

  /** Installed version */
  version?: string;
}

/**
 * Plugin list entry for display
 */
export interface PluginListEntry {
  id: string;
  name: string;
  version: string;
  description?: string;
  enabled: boolean;
  hasBackend: boolean;
  hasFrontend: boolean;
  source: string;
}

/**
 * Validate plugin ID format
 *
 * Must be lowercase alphanumeric with hyphens, 3-50 characters.
 * - Must start with a lowercase letter
 * - Must end with a lowercase letter or digit
 * - Can contain lowercase letters, digits, and hyphens in the middle
 *
 * Regex breakdown: `/^[a-z][a-z0-9-]{1,48}[a-z0-9]$/`
 * - `^[a-z]` - Start with a lowercase letter
 * - `[a-z0-9-]{1,48}` - 1-48 characters of lowercase letters, digits, or hyphens
 * - `[a-z0-9]$` - End with a lowercase letter or digit
 * - Total length: 3-50 characters (1 + 1-48 + 1)
 *
 * @example
 * isValidPluginId("my-plugin") // true
 * isValidPluginId("a1") // false (too short, needs at least 3 chars)
 * isValidPluginId("my_plugin") // false (underscores not allowed)
 * isValidPluginId("my-plugin-") // false (cannot end with hyphen)
 */
export function isValidPluginId(id: string): boolean {
  return /^[a-z][a-z0-9-]{1,48}[a-z0-9]$/.test(id);
}

/**
 * Validate semantic version format
 */
export function isValidVersion(version: string): boolean {
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(version);
}

/**
 * Validate CalVer format (YYYY.MM.patch or YYYY.MM.patch-stage.N)
 */
export function isValidCalVer(version: string): boolean {
  return /^\d{4}\.\d{1,2}\.\d+(-[a-zA-Z]+\.\d+)?$/.test(version);
}
