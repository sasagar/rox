/**
 * Secure Plugin Context Unit Tests
 *
 * Tests for the permission-aware plugin context including
 * event bus wrapping and config storage security.
 *
 * @module tests/unit/SecurePluginContext.test
 */

import { describe, it, expect, beforeEach } from "bun:test";
import pino from "pino";
import { createSecurePluginContext, PluginSecurityAuditor } from "../../plugins/SecurePluginContext.js";
import { PluginPermissionManager, PluginPermissionError } from "../../plugins/PluginPermissions.js";
import type { IEventBus } from "../../interfaces/IEventBus.js";
import type { PluginConfigStorage } from "../../plugins/types/plugin.js";

// Create a silent logger for tests
const testLogger = pino({ level: "silent" });

// Mock event bus - use 'as' type assertion to satisfy IEventBus interface
function createMockEventBus(): IEventBus {
  const handlers = new Map<string, Array<(...args: unknown[]) => unknown>>();
  const beforeHandlers = new Map<string, Array<(...args: unknown[]) => unknown>>();

  return {
    emit: (async () => {}) as IEventBus["emit"],
    emitBefore: (async () => ({ cancelled: false, data: {} })) as IEventBus["emitBefore"],
    on: ((type: string, handler: (...args: unknown[]) => unknown) => {
      if (!handlers.has(type)) {
        handlers.set(type, []);
      }
      handlers.get(type)!.push(handler);
      return () => {
        const h = handlers.get(type);
        if (h) {
          const idx = h.indexOf(handler);
          if (idx !== -1) h.splice(idx, 1);
        }
      };
    }) as IEventBus["on"],
    onBefore: ((type: string, handler: (...args: unknown[]) => unknown) => {
      if (!beforeHandlers.has(type)) {
        beforeHandlers.set(type, []);
      }
      beforeHandlers.get(type)!.push(handler);
      return () => {
        const h = beforeHandlers.get(type);
        if (h) {
          const idx = h.indexOf(handler);
          if (idx !== -1) h.splice(idx, 1);
        }
      };
    }) as IEventBus["onBefore"],
    removeAllListeners: () => {},
  };
}

// Mock config storage
function createMockConfigStorage(): PluginConfigStorage {
  const storage = new Map<string, unknown>();
  return {
    get: async <T>(key: string): Promise<T | undefined> => {
      return storage.get(key) as T | undefined;
    },
    set: async <T>(key: string, value: T): Promise<void> => {
      storage.set(key, value);
    },
    delete: async (key: string): Promise<void> => {
      storage.delete(key);
    },
    getAll: async (): Promise<Record<string, unknown>> => {
      return Object.fromEntries(storage);
    },
  };
}

describe("SecurePluginContext", () => {
  let permissionManager: PluginPermissionManager;
  let mockEventBus: IEventBus;
  let mockConfigStorage: PluginConfigStorage;

  beforeEach(() => {
    permissionManager = new PluginPermissionManager(testLogger);
    mockEventBus = createMockEventBus();
    mockConfigStorage = createMockConfigStorage();
  });

  describe("createSecurePluginContext", () => {
    it("should create a context with all required properties", () => {
      permissionManager.registerPlugin("test-plugin", ["note:read", "config:read"]);

      const context = createSecurePluginContext({
        pluginId: "test-plugin",
        events: mockEventBus,
        logger: testLogger,
        config: mockConfigStorage,
        baseUrl: "http://localhost:3000",
        roxVersion: "2025.1.0",
        permissionManager,
        onRegisterTask: () => {},
      });

      expect(context.events).toBeDefined();
      expect(context.logger).toBeDefined();
      expect(context.config).toBeDefined();
      expect(context.baseUrl).toBe("http://localhost:3000");
      expect(context.roxVersion).toBe("2025.1.0");
      expect(context.registerScheduledTask).toBeDefined();
    });
  });

  describe("Secure Event Bus", () => {
    it("should allow subscribing to events with proper permissions", () => {
      permissionManager.registerPlugin("test-plugin", ["note:read"]);

      const context = createSecurePluginContext({
        pluginId: "test-plugin",
        events: mockEventBus,
        logger: testLogger,
        config: mockConfigStorage,
        baseUrl: "http://localhost:3000",
        roxVersion: "2025.1.0",
        permissionManager,
        onRegisterTask: () => {},
      });

      // Should not throw for event requiring note:read
      expect(() => {
        context.events.on("note:afterCreate", () => {});
      }).not.toThrow();
    });

    it("should reject subscribing to events without proper permissions", () => {
      permissionManager.registerPlugin("test-plugin", ["config:read"]);

      const context = createSecurePluginContext({
        pluginId: "test-plugin",
        events: mockEventBus,
        logger: testLogger,
        config: mockConfigStorage,
        baseUrl: "http://localhost:3000",
        roxVersion: "2025.1.0",
        permissionManager,
        onRegisterTask: () => {},
      });

      // Should throw for event requiring note:read
      expect(() => {
        context.events.on("note:afterCreate", () => {});
      }).toThrow(PluginPermissionError);
    });

    it("should require write permission for before events", () => {
      // Only read permission
      permissionManager.registerPlugin("test-plugin", ["note:read"]);

      const context = createSecurePluginContext({
        pluginId: "test-plugin",
        events: mockEventBus,
        logger: testLogger,
        config: mockConfigStorage,
        baseUrl: "http://localhost:3000",
        roxVersion: "2025.1.0",
        permissionManager,
        onRegisterTask: () => {},
      });

      // Should throw for before event requiring note:write
      expect(() => {
        context.events.onBefore("note:beforeCreate", async () => ({}));
      }).toThrow(PluginPermissionError);
    });

    it("should allow before events with write permission", () => {
      permissionManager.registerPlugin("test-plugin", ["note:write"]);

      const context = createSecurePluginContext({
        pluginId: "test-plugin",
        events: mockEventBus,
        logger: testLogger,
        config: mockConfigStorage,
        baseUrl: "http://localhost:3000",
        roxVersion: "2025.1.0",
        permissionManager,
        onRegisterTask: () => {},
      });

      // Should not throw with write permission
      expect(() => {
        context.events.onBefore("note:beforeCreate", async () => ({}));
      }).not.toThrow();
    });
  });

  describe("Secure Config Storage", () => {
    it("should allow config read with config:read permission", async () => {
      permissionManager.registerPlugin("test-plugin", ["config:read"]);

      const context = createSecurePluginContext({
        pluginId: "test-plugin",
        events: mockEventBus,
        logger: testLogger,
        config: mockConfigStorage,
        baseUrl: "http://localhost:3000",
        roxVersion: "2025.1.0",
        permissionManager,
        onRegisterTask: () => {},
      });

      // Should not throw - verify by checking the operation completes
      const value = await context.config.get("test-key");
      expect(value).toBeUndefined(); // Storage is empty

      const allValues = await context.config.getAll();
      expect(allValues).toEqual({});
    });

    it("should reject config read without config:read permission", async () => {
      permissionManager.registerPlugin("test-plugin", ["note:read"]);

      const context = createSecurePluginContext({
        pluginId: "test-plugin",
        events: mockEventBus,
        logger: testLogger,
        config: mockConfigStorage,
        baseUrl: "http://localhost:3000",
        roxVersion: "2025.1.0",
        permissionManager,
        onRegisterTask: () => {},
      });

      // Should throw
      await expect(context.config.get("test-key")).rejects.toThrow(PluginPermissionError);
    });

    it("should allow config write with config:write permission", async () => {
      // Register both read and write permissions to properly test write operations
      // (reading back the value requires config:read)
      permissionManager.registerPlugin("test-plugin", ["config:read", "config:write"]);

      const context = createSecurePluginContext({
        pluginId: "test-plugin",
        events: mockEventBus,
        logger: testLogger,
        config: mockConfigStorage,
        baseUrl: "http://localhost:3000",
        roxVersion: "2025.1.0",
        permissionManager,
        onRegisterTask: () => {},
      });

      // Verify write operations work with proper permissions
      await context.config.set("test-key", "test-value");
      const value = await context.config.get<string>("test-key");
      expect(value).toBe("test-value");

      await context.config.delete("test-key");
      const deletedValue = await context.config.get<string>("test-key");
      expect(deletedValue).toBeUndefined();
    });

    it("should reject config write without config:write permission", async () => {
      permissionManager.registerPlugin("test-plugin", ["config:read"]);

      const context = createSecurePluginContext({
        pluginId: "test-plugin",
        events: mockEventBus,
        logger: testLogger,
        config: mockConfigStorage,
        baseUrl: "http://localhost:3000",
        roxVersion: "2025.1.0",
        permissionManager,
        onRegisterTask: () => {},
      });

      // Should throw
      await expect(context.config.set("test-key", "value")).rejects.toThrow(
        PluginPermissionError
      );
    });
  });

  describe("Plugin without config permissions", () => {
    it("should throw for all config operations", async () => {
      permissionManager.registerPlugin("test-plugin", ["note:read"]);

      const context = createSecurePluginContext({
        pluginId: "test-plugin",
        events: mockEventBus,
        logger: testLogger,
        config: mockConfigStorage,
        baseUrl: "http://localhost:3000",
        roxVersion: "2025.1.0",
        permissionManager,
        onRegisterTask: () => {},
      });

      await expect(context.config.get("key")).rejects.toThrow(PluginPermissionError);
      await expect(context.config.set("key", "value")).rejects.toThrow(
        PluginPermissionError
      );
      await expect(context.config.delete("key")).rejects.toThrow(PluginPermissionError);
      await expect(context.config.getAll()).rejects.toThrow(PluginPermissionError);
    });
  });
});

describe("PluginSecurityAuditor", () => {
  let auditor: PluginSecurityAuditor;

  beforeEach(() => {
    auditor = new PluginSecurityAuditor(testLogger);
  });

  describe("log", () => {
    it("should log security events", () => {
      auditor.log("test-plugin", "loaded", true, undefined, { version: "1.0.0" });

      const logs = auditor.getAuditLog();
      expect(logs.length).toBe(1);
      expect(logs[0]!.pluginId).toBe("test-plugin");
      expect(logs[0]!.action).toBe("loaded");
      expect(logs[0]!.granted).toBe(true);
    });

    it("should include permission in log entry", () => {
      auditor.log("test-plugin", "permission_check", true, "note:read");

      const logs = auditor.getAuditLog();
      expect(logs[0]!.permission).toBe("note:read");
    });

    it("should limit audit log to 1000 entries", () => {
      for (let i = 0; i < 1100; i++) {
        auditor.log(`plugin-${i}`, "test", true);
      }

      const logs = auditor.getAuditLog();
      expect(logs.length).toBe(1000);
    });
  });

  describe("getAuditLog", () => {
    beforeEach(() => {
      auditor.log("plugin-a", "loaded", true);
      auditor.log("plugin-b", "permission_denied", false, "admin:write");
      auditor.log("plugin-a", "unloaded", true);
    });

    it("should filter by pluginId", () => {
      const logs = auditor.getAuditLog({ pluginId: "plugin-a" });
      expect(logs.length).toBe(2);
      expect(logs.every((l) => l.pluginId === "plugin-a")).toBe(true);
    });

    it("should filter by grantedOnly", () => {
      const logs = auditor.getAuditLog({ grantedOnly: true });
      expect(logs.every((l) => l.granted)).toBe(true);
    });

    it("should filter by deniedOnly", () => {
      const logs = auditor.getAuditLog({ deniedOnly: true });
      expect(logs.every((l) => !l.granted)).toBe(true);
    });

    it("should filter by time range", () => {
      const startTime = new Date();

      // Add entry after startTime
      auditor.log("plugin-c", "test", true);

      const logs = auditor.getAuditLog({ startTime });
      expect(logs.length).toBeGreaterThanOrEqual(1);
      expect(logs.every((l) => l.timestamp >= startTime)).toBe(true);
    });
  });

  describe("clear", () => {
    it("should clear all audit log entries", () => {
      auditor.log("test-plugin", "test", true);
      auditor.log("test-plugin", "test2", true);

      auditor.clear();

      expect(auditor.getAuditLog()).toEqual([]);
    });
  });
});
