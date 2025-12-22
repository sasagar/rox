/**
 * Plugin Manifest Validator
 *
 * Validates plugin.json manifest files to ensure they meet
 * the required format and constraints.
 */

import type {
  PluginManifest,
  PluginPermission,
} from "shared";
import {
  isValidPluginId,
  isValidVersion,
  isValidCalVer,
} from "shared";

/**
 * Validation error with field path
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
}

/**
 * Valid permission values
 */
const VALID_PERMISSIONS: PluginPermission[] = [
  "note:read",
  "note:write",
  "user:read",
  "user:write",
  "config:read",
  "config:write",
  "admin:read",
  "admin:write",
  "storage:read",
  "storage:write",
];

/**
 * Validate a plugin manifest
 */
export function validateManifest(
  manifest: unknown,
  _options: { checkFiles?: boolean; pluginPath?: string } = {}
): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: string[] = [];

  // Check if manifest is an object
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return {
      valid: false,
      errors: [{ field: "", message: "Manifest must be a JSON object" }],
      warnings: [],
    };
  }

  const m = manifest as Record<string, unknown>;

  // Required fields
  if (!m.id || typeof m.id !== "string") {
    errors.push({ field: "id", message: "id is required and must be a string" });
  } else if (!isValidPluginId(m.id)) {
    errors.push({
      field: "id",
      message: "id must be lowercase alphanumeric with hyphens, 3-50 characters, starting with a letter",
    });
  }

  if (!m.name || typeof m.name !== "string") {
    errors.push({ field: "name", message: "name is required and must be a string" });
  } else if (m.name.length > 100) {
    errors.push({ field: "name", message: "name must be 100 characters or less" });
  }

  if (!m.version || typeof m.version !== "string") {
    errors.push({ field: "version", message: "version is required and must be a string" });
  } else if (!isValidVersion(m.version)) {
    errors.push({
      field: "version",
      message: "version must be in semantic versioning format (e.g., 1.0.0)",
    });
  }

  // Optional string fields
  if (m.description !== undefined) {
    if (typeof m.description !== "string") {
      errors.push({ field: "description", message: "description must be a string" });
    } else if (m.description.length > 500) {
      errors.push({ field: "description", message: "description must be 500 characters or less" });
    }
  }

  if (m.author !== undefined && typeof m.author !== "string") {
    errors.push({ field: "author", message: "author must be a string" });
  }

  if (m.license !== undefined && typeof m.license !== "string") {
    errors.push({ field: "license", message: "license must be a string" });
  }

  if (m.homepage !== undefined) {
    if (typeof m.homepage !== "string") {
      errors.push({ field: "homepage", message: "homepage must be a string" });
    } else if (!isValidUrl(m.homepage)) {
      errors.push({ field: "homepage", message: "homepage must be a valid URL" });
    }
  }

  if (m.repository !== undefined) {
    if (typeof m.repository !== "string") {
      errors.push({ field: "repository", message: "repository must be a string" });
    } else if (!isValidUrl(m.repository)) {
      errors.push({ field: "repository", message: "repository must be a valid URL" });
    }
  }

  // Version constraints
  if (m.minRoxVersion !== undefined) {
    if (typeof m.minRoxVersion !== "string") {
      errors.push({ field: "minRoxVersion", message: "minRoxVersion must be a string" });
    } else if (!isValidCalVer(m.minRoxVersion)) {
      errors.push({
        field: "minRoxVersion",
        message: "minRoxVersion must be in CalVer format (e.g., 2025.12.0)",
      });
    }
  }

  if (m.maxRoxVersion !== undefined) {
    if (typeof m.maxRoxVersion !== "string") {
      errors.push({ field: "maxRoxVersion", message: "maxRoxVersion must be a string" });
    } else if (!isValidCalVer(m.maxRoxVersion)) {
      errors.push({
        field: "maxRoxVersion",
        message: "maxRoxVersion must be in CalVer format (e.g., 2025.12.0)",
      });
    }
  }

  // Permissions
  if (m.permissions !== undefined) {
    if (!Array.isArray(m.permissions)) {
      errors.push({ field: "permissions", message: "permissions must be an array" });
    } else {
      for (let i = 0; i < m.permissions.length; i++) {
        const perm = m.permissions[i];
        if (typeof perm !== "string") {
          errors.push({
            field: `permissions[${i}]`,
            message: "permission must be a string",
          });
        } else if (!VALID_PERMISSIONS.includes(perm as PluginPermission)) {
          errors.push({
            field: `permissions[${i}]`,
            message: `invalid permission: ${perm}. Valid permissions: ${VALID_PERMISSIONS.join(", ")}`,
          });
        }
      }
    }
  }

  // Dependencies
  if (m.dependencies !== undefined) {
    if (!Array.isArray(m.dependencies)) {
      errors.push({ field: "dependencies", message: "dependencies must be an array" });
    } else {
      for (let i = 0; i < m.dependencies.length; i++) {
        const dep = m.dependencies[i];
        if (typeof dep !== "string") {
          errors.push({
            field: `dependencies[${i}]`,
            message: "dependency must be a string",
          });
        } else if (!isValidPluginId(dep)) {
          errors.push({
            field: `dependencies[${i}]`,
            message: `invalid dependency ID: ${dep}`,
          });
        }
      }
    }
  }

  // Entry points
  if (m.backend !== undefined && typeof m.backend !== "string") {
    errors.push({ field: "backend", message: "backend must be a string path" });
  }

  if (m.frontend !== undefined && typeof m.frontend !== "string") {
    errors.push({ field: "frontend", message: "frontend must be a string path" });
  }

  // At least one entry point should exist
  if (!m.backend && !m.frontend) {
    warnings.push("Plugin has no backend or frontend entry point defined");
  }

  // Keywords
  if (m.keywords !== undefined) {
    if (!Array.isArray(m.keywords)) {
      errors.push({ field: "keywords", message: "keywords must be an array" });
    } else {
      for (let i = 0; i < m.keywords.length; i++) {
        if (typeof m.keywords[i] !== "string") {
          errors.push({
            field: `keywords[${i}]`,
            message: "keyword must be a string",
          });
        }
      }
    }
  }

  // Config schema (basic validation - just check it's an object)
  if (m.configSchema !== undefined) {
    if (typeof m.configSchema !== "object" || Array.isArray(m.configSchema)) {
      errors.push({ field: "configSchema", message: "configSchema must be an object" });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Parse and validate a manifest from JSON string
 */
export function parseManifest(json: string): {
  manifest?: PluginManifest;
  validation: ValidationResult;
} {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return {
      validation: {
        valid: false,
        errors: [{ field: "", message: "Invalid JSON" }],
        warnings: [],
      },
    };
  }

  const validation = validateManifest(parsed);

  if (validation.valid) {
    return {
      manifest: parsed as PluginManifest,
      validation,
    };
  }

  return { validation };
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}
