/**
 * Secure Plugin Context
 *
 * Provides a permission-aware context for plugins that validates
 * access to resources based on declared permissions.
 *
 * @module plugins/SecurePluginContext
 */

import type pino from "pino";
import type { IEventBus } from "../interfaces/IEventBus.js";
import type {
  PluginContext,
  PluginConfigStorage,
  ScheduledTask,
  PluginPermission,
} from "./types/plugin.js";
import {
  PluginPermissionManager,
  PluginPermissionError,
} from "./PluginPermissions.js";

/**
 * Event types and their required permissions
 */
const EVENT_PERMISSIONS: Record<string, PluginPermission[]> = {
  "note:beforeCreate": ["note:write"],
  "note:afterCreate": ["note:read"],
  "note:beforeDelete": ["note:write"],
  "note:afterDelete": ["note:read"],
  "user:beforeRegister": ["user:write"],
  "user:afterRegister": ["user:read"],
};

/**
 * Options for creating a secure plugin context
 */
export interface SecurePluginContextOptions {
  /** Plugin identifier */
  pluginId: string;
  /** Event bus instance */
  events: IEventBus;
  /** Logger instance */
  logger: pino.Logger;
  /** Config storage instance */
  config: PluginConfigStorage;
  /** Base URL of the instance */
  baseUrl: string;
  /** Rox version */
  roxVersion: string;
  /** Permission manager */
  permissionManager: PluginPermissionManager;
  /** Callback for registering scheduled tasks */
  onRegisterTask: (task: ScheduledTask) => void;
}

/**
 * Create a secure event bus wrapper
 *
 * Wraps the event bus to check permissions before allowing subscriptions.
 */
function createSecureEventBus(
  events: IEventBus,
  pluginId: string,
  permissionManager: PluginPermissionManager,
  logger: pino.Logger
): IEventBus {
  return {
    emit: events.emit.bind(events),
    emitBefore: events.emitBefore.bind(events),

    on: (type, handler) => {
      const requiredPermissions = EVENT_PERMISSIONS[type];
      if (requiredPermissions) {
        const hasPermission = permissionManager.hasAnyPermission(
          pluginId,
          requiredPermissions
        );
        if (!hasPermission) {
          logger.warn(
            {
              pluginId,
              eventType: type,
              requiredPermissions,
            },
            "Plugin attempted to subscribe to event without permission"
          );
          const firstPermission = requiredPermissions[0];
          throw new PluginPermissionError(
            `Plugin '${pluginId}' does not have permission to subscribe to '${type}' events`,
            pluginId,
            firstPermission ?? "note:read"
          );
        }
        const firstPermission = requiredPermissions[0];
        if (firstPermission) {
          permissionManager.logPermissionCheck(
            pluginId,
            firstPermission,
            true,
            `subscribe to ${type}`
          );
        }
      }
      return events.on(type, handler);
    },

    onBefore: (type, handler) => {
      const requiredPermissions = EVENT_PERMISSIONS[type];
      if (requiredPermissions) {
        // Before events require write permission for the resource
        const writePermission = requiredPermissions.find((p) =>
          p.endsWith(":write")
        );
        if (writePermission && !permissionManager.hasPermission(pluginId, writePermission)) {
          logger.warn(
            {
              pluginId,
              eventType: type,
              requiredPermission: writePermission,
            },
            "Plugin attempted to subscribe to before event without write permission"
          );
          throw new PluginPermissionError(
            `Plugin '${pluginId}' does not have '${writePermission}' permission required for '${type}' before events`,
            pluginId,
            writePermission
          );
        }
        if (writePermission) {
          permissionManager.logPermissionCheck(
            pluginId,
            writePermission,
            true,
            `subscribe to ${type} (before)`
          );
        }
      }
      return events.onBefore(type, handler);
    },

    removeAllListeners: () => {
      // Only allow removing own listeners - this is handled by the loader
      logger.warn(
        { pluginId },
        "Plugin attempted to remove all listeners - operation restricted"
      );
    },
  };
}

/**
 * Create a secure config storage wrapper
 *
 * Wraps config storage to check permissions before read/write operations.
 */
function createSecureConfigStorage(
  config: PluginConfigStorage,
  pluginId: string,
  permissionManager: PluginPermissionManager
): PluginConfigStorage {
  return {
    get: async <T>(key: string): Promise<T | undefined> => {
      permissionManager.assertPermission(pluginId, "config:read");
      permissionManager.logPermissionCheck(
        pluginId,
        "config:read",
        true,
        `read config key: ${key}`
      );
      return config.get<T>(key);
    },

    set: async <T>(key: string, value: T): Promise<void> => {
      permissionManager.assertPermission(pluginId, "config:write");
      permissionManager.logPermissionCheck(
        pluginId,
        "config:write",
        true,
        `write config key: ${key}`
      );
      return config.set(key, value);
    },

    delete: async (key: string): Promise<void> => {
      permissionManager.assertPermission(pluginId, "config:write");
      permissionManager.logPermissionCheck(
        pluginId,
        "config:write",
        true,
        `delete config key: ${key}`
      );
      return config.delete(key);
    },

    getAll: async (): Promise<Record<string, unknown>> => {
      permissionManager.assertPermission(pluginId, "config:read");
      permissionManager.logPermissionCheck(
        pluginId,
        "config:read",
        true,
        "read all config"
      );
      return config.getAll();
    },
  };
}

/**
 * Create a secure plugin context
 *
 * This context wraps the standard plugin context with permission checks.
 *
 * @param options - Context creation options
 * @returns Secure plugin context with permission enforcement
 */
export function createSecurePluginContext(
  options: SecurePluginContextOptions
): PluginContext {
  const {
    pluginId,
    events,
    logger,
    config,
    baseUrl,
    roxVersion,
    permissionManager,
    onRegisterTask,
  } = options;

  // Create secure wrappers
  const secureEvents = createSecureEventBus(
    events,
    pluginId,
    permissionManager,
    logger
  );

  // Only wrap config if the plugin has config permissions
  const hasConfigRead = permissionManager.hasPermission(pluginId, "config:read");
  const hasConfigWrite = permissionManager.hasPermission(pluginId, "config:write");

  let secureConfig: PluginConfigStorage;
  if (hasConfigRead || hasConfigWrite) {
    secureConfig = createSecureConfigStorage(
      config,
      pluginId,
      permissionManager
    );
  } else {
    // No config permissions - provide a stub that throws
    secureConfig = {
      get: async () => {
        throw new PluginPermissionError(
          `Plugin '${pluginId}' does not have config:read permission`,
          pluginId,
          "config:read"
        );
      },
      set: async () => {
        throw new PluginPermissionError(
          `Plugin '${pluginId}' does not have config:write permission`,
          pluginId,
          "config:write"
        );
      },
      delete: async () => {
        throw new PluginPermissionError(
          `Plugin '${pluginId}' does not have config:write permission`,
          pluginId,
          "config:write"
        );
      },
      getAll: async () => {
        throw new PluginPermissionError(
          `Plugin '${pluginId}' does not have config:read permission`,
          pluginId,
          "config:read"
        );
      },
    };
  }

  return {
    events: secureEvents,
    logger,
    config: secureConfig,
    baseUrl,
    roxVersion,
    registerScheduledTask: onRegisterTask,
  };
}

/**
 * Plugin Security Auditor
 *
 * Tracks and logs security-relevant plugin actions.
 */
export class PluginSecurityAuditor {
  private logger: pino.Logger;
  private auditLog: Array<{
    timestamp: Date;
    pluginId: string;
    action: string;
    permission?: PluginPermission;
    granted: boolean;
    details?: Record<string, unknown>;
  }> = [];

  constructor(logger?: pino.Logger) {
    this.logger = logger || require("pino")({ name: "plugin-security-audit" });
  }

  /**
   * Log a security event
   */
  log(
    pluginId: string,
    action: string,
    granted: boolean,
    permission?: PluginPermission,
    details?: Record<string, unknown>
  ): void {
    const entry = {
      timestamp: new Date(),
      pluginId,
      action,
      permission,
      granted,
      details,
    };

    this.auditLog.push(entry);

    // Keep only last 1000 entries
    if (this.auditLog.length > 1000) {
      this.auditLog.shift();
    }

    // Log to standard logger
    const level = granted ? "info" : "warn";
    this.logger[level](
      {
        pluginId,
        action,
        permission,
        granted,
        ...details,
      },
      `Security audit: ${action}`
    );
  }

  /**
   * Get audit log entries
   */
  getAuditLog(
    options?: {
      pluginId?: string;
      startTime?: Date;
      endTime?: Date;
      grantedOnly?: boolean;
      deniedOnly?: boolean;
    }
  ): typeof this.auditLog {
    let entries = [...this.auditLog];

    if (options?.pluginId) {
      entries = entries.filter((e) => e.pluginId === options.pluginId);
    }
    if (options?.startTime) {
      entries = entries.filter((e) => e.timestamp >= options.startTime!);
    }
    if (options?.endTime) {
      entries = entries.filter((e) => e.timestamp <= options.endTime!);
    }
    if (options?.grantedOnly) {
      entries = entries.filter((e) => e.granted);
    }
    if (options?.deniedOnly) {
      entries = entries.filter((e) => !e.granted);
    }

    return entries;
  }

  /**
   * Clear audit log
   */
  clear(): void {
    this.auditLog = [];
  }
}
