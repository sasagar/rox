/**
 * Plugin Permissions System
 *
 * Provides permission validation and enforcement for plugins.
 * Ensures plugins only access resources they have been granted permission for.
 *
 * @module plugins/PluginPermissions
 */

import type { PluginPermission, PluginManifest } from "shared";
import pino from "pino";

/**
 * Permission category definitions
 */
export const PERMISSION_CATEGORIES = {
  note: ["note:read", "note:write"] as const,
  user: ["user:read", "user:write"] as const,
  storage: ["storage:read", "storage:write"] as const,
  admin: ["admin:read", "admin:write"] as const,
  config: ["config:read", "config:write"] as const,
} as const;

/**
 * Permission descriptions for display in admin UI
 */
export const PERMISSION_DESCRIPTIONS: Record<PluginPermission, string> = {
  "note:read": "Read notes and their content",
  "note:write": "Create, update, and delete notes",
  "user:read": "Read user profiles and information",
  "user:write": "Modify user data and settings",
  "storage:read": "Read uploaded files and media",
  "storage:write": "Upload, modify, and delete files",
  "admin:read": "Read administrative settings and data",
  "admin:write": "Modify administrative settings",
  "config:read": "Read plugin configuration",
  "config:write": "Modify plugin configuration",
};

/**
 * Permission risk levels
 */
export const PERMISSION_RISK_LEVELS: Record<PluginPermission, "low" | "medium" | "high"> = {
  "note:read": "low",
  "note:write": "medium",
  "user:read": "low",
  "user:write": "high",
  "storage:read": "low",
  "storage:write": "medium",
  "admin:read": "medium",
  "admin:write": "high",
  "config:read": "low",
  "config:write": "low",
};

/**
 * All valid permissions
 */
export const ALL_PERMISSIONS: PluginPermission[] = [
  "note:read",
  "note:write",
  "user:read",
  "user:write",
  "storage:read",
  "storage:write",
  "admin:read",
  "admin:write",
  "config:read",
  "config:write",
];

/**
 * Validate permission string
 */
export function isValidPermission(permission: string): permission is PluginPermission {
  return ALL_PERMISSIONS.includes(permission as PluginPermission);
}

/**
 * Plugin Permission Manager
 *
 * Manages and validates permissions for loaded plugins.
 */
export class PluginPermissionManager {
  private pluginPermissions: Map<string, Set<PluginPermission>> = new Map();
  private logger: pino.Logger;

  constructor(logger?: pino.Logger) {
    this.logger = logger || pino({ name: "plugin-permissions" });
  }

  /**
   * Register a plugin's permissions
   *
   * @param pluginId - Plugin identifier
   * @param permissions - Array of requested permissions
   */
  registerPlugin(pluginId: string, permissions: PluginPermission[]): void {
    const validPermissions = permissions.filter(isValidPermission);
    const invalidPermissions = permissions.filter((p) => !isValidPermission(p));

    if (invalidPermissions.length > 0) {
      this.logger.warn(
        { pluginId, invalidPermissions },
        "Plugin requested invalid permissions (ignored)"
      );
    }

    this.pluginPermissions.set(pluginId, new Set(validPermissions));
    this.logger.debug(
      { pluginId, permissions: validPermissions },
      "Registered plugin permissions"
    );
  }

  /**
   * Unregister a plugin
   *
   * @param pluginId - Plugin identifier
   */
  unregisterPlugin(pluginId: string): void {
    this.pluginPermissions.delete(pluginId);
  }

  /**
   * Check if a plugin has a specific permission
   *
   * @param pluginId - Plugin identifier
   * @param permission - Permission to check
   * @returns true if the plugin has the permission
   */
  hasPermission(pluginId: string, permission: PluginPermission): boolean {
    const permissions = this.pluginPermissions.get(pluginId);
    return permissions?.has(permission) ?? false;
  }

  /**
   * Check if a plugin has any of the specified permissions
   *
   * @param pluginId - Plugin identifier
   * @param permissions - Permissions to check
   * @returns true if the plugin has any of the permissions
   */
  hasAnyPermission(pluginId: string, permissions: PluginPermission[]): boolean {
    return permissions.some((p) => this.hasPermission(pluginId, p));
  }

  /**
   * Check if a plugin has all of the specified permissions
   *
   * @param pluginId - Plugin identifier
   * @param permissions - Permissions to check
   * @returns true if the plugin has all the permissions
   */
  hasAllPermissions(pluginId: string, permissions: PluginPermission[]): boolean {
    return permissions.every((p) => this.hasPermission(pluginId, p));
  }

  /**
   * Get all permissions for a plugin
   *
   * @param pluginId - Plugin identifier
   * @returns Array of permissions or empty array if plugin not found
   */
  getPermissions(pluginId: string): PluginPermission[] {
    const permissions = this.pluginPermissions.get(pluginId);
    return permissions ? Array.from(permissions) : [];
  }

  /**
   * Assert that a plugin has a permission, throwing if not
   *
   * @param pluginId - Plugin identifier
   * @param permission - Required permission
   * @throws Error if plugin doesn't have the permission
   */
  assertPermission(pluginId: string, permission: PluginPermission): void {
    if (!this.hasPermission(pluginId, permission)) {
      const error = new PluginPermissionError(
        `Plugin '${pluginId}' does not have permission '${permission}'`,
        pluginId,
        permission
      );
      this.logger.warn(
        { pluginId, permission, error: error.message },
        "Permission denied"
      );
      throw error;
    }
  }

  /**
   * Log a permission check (for audit purposes)
   *
   * @param pluginId - Plugin identifier
   * @param permission - Permission being checked
   * @param granted - Whether the permission was granted
   * @param action - Description of the action being performed
   */
  logPermissionCheck(
    pluginId: string,
    permission: PluginPermission,
    granted: boolean,
    action?: string
  ): void {
    const level = granted ? "debug" : "warn";
    this.logger[level](
      {
        pluginId,
        permission,
        granted,
        action,
      },
      `Permission check: ${granted ? "granted" : "denied"}`
    );
  }

  /**
   * Validate a plugin manifest's permissions
   *
   * @param manifest - Plugin manifest to validate
   * @returns Validation result with any warnings
   */
  validateManifestPermissions(manifest: PluginManifest): {
    valid: boolean;
    errors: string[];
    warnings: string[];
    highRiskPermissions: PluginPermission[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const highRiskPermissions: PluginPermission[] = [];

    if (!manifest.permissions || manifest.permissions.length === 0) {
      // No permissions is valid, but worth noting
      warnings.push("Plugin declares no permissions");
      return { valid: true, errors, warnings, highRiskPermissions };
    }

    for (const permission of manifest.permissions) {
      if (!isValidPermission(permission)) {
        errors.push(`Invalid permission: ${permission}`);
        continue;
      }

      const riskLevel = PERMISSION_RISK_LEVELS[permission];
      if (riskLevel === "high") {
        highRiskPermissions.push(permission);
        warnings.push(`High-risk permission requested: ${permission}`);
      }
    }

    // Check for potentially dangerous permission combinations
    if (
      manifest.permissions.includes("admin:write") &&
      manifest.permissions.includes("user:write")
    ) {
      warnings.push(
        "Plugin requests both admin:write and user:write - this is a powerful combination"
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      highRiskPermissions,
    };
  }

  /**
   * Clear all registered plugins
   */
  clear(): void {
    this.pluginPermissions.clear();
  }
}

/**
 * Custom error for permission violations
 */
export class PluginPermissionError extends Error {
  constructor(
    message: string,
    public readonly pluginId: string,
    public readonly permission: PluginPermission
  ) {
    super(message);
    this.name = "PluginPermissionError";
  }
}

/**
 * Create a permission-aware wrapper for a function
 *
 * @param pluginId - Plugin identifier
 * @param permission - Required permission
 * @param manager - Permission manager instance
 * @param fn - Function to wrap
 * @returns Wrapped function that checks permission before executing
 */
export function withPermission<T extends (...args: unknown[]) => unknown>(
  pluginId: string,
  permission: PluginPermission,
  manager: PluginPermissionManager,
  fn: T
): T {
  return ((...args: Parameters<T>) => {
    manager.assertPermission(pluginId, permission);
    return fn(...args);
  }) as T;
}
