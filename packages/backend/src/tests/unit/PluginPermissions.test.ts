/**
 * Plugin Permissions Unit Tests
 *
 * Tests for the plugin permission system including validation,
 * permission checking, and security auditing.
 *
 * @module tests/unit/PluginPermissions.test
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  PluginPermissionManager,
  PluginPermissionError,
  isValidPermission,
  ALL_PERMISSIONS,
  PERMISSION_RISK_LEVELS,
} from "../../plugins/PluginPermissions.js";
import type { PluginPermission, PluginManifest } from "../../plugins/types/plugin.js";

describe("PluginPermissions", () => {
  describe("isValidPermission", () => {
    it("should return true for valid permissions", () => {
      expect(isValidPermission("note:read")).toBe(true);
      expect(isValidPermission("note:write")).toBe(true);
      expect(isValidPermission("user:read")).toBe(true);
      expect(isValidPermission("admin:write")).toBe(true);
      expect(isValidPermission("config:read")).toBe(true);
    });

    it("should return false for invalid permissions", () => {
      expect(isValidPermission("invalid:permission")).toBe(false);
      expect(isValidPermission("note:execute")).toBe(false);
      expect(isValidPermission("")).toBe(false);
      expect(isValidPermission("random")).toBe(false);
    });
  });

  describe("PluginPermissionManager", () => {
    let manager: PluginPermissionManager;

    beforeEach(() => {
      manager = new PluginPermissionManager();
    });

    describe("registerPlugin", () => {
      it("should register a plugin with valid permissions", () => {
        manager.registerPlugin("test-plugin", ["note:read", "note:write"]);

        expect(manager.hasPermission("test-plugin", "note:read")).toBe(true);
        expect(manager.hasPermission("test-plugin", "note:write")).toBe(true);
        expect(manager.hasPermission("test-plugin", "user:read")).toBe(false);
      });

      it("should filter out invalid permissions", () => {
        manager.registerPlugin("test-plugin", [
          "note:read",
          "invalid:permission" as PluginPermission,
        ]);

        expect(manager.hasPermission("test-plugin", "note:read")).toBe(true);
        expect(manager.getPermissions("test-plugin")).toEqual(["note:read"]);
      });

      it("should handle empty permissions array", () => {
        manager.registerPlugin("test-plugin", []);

        expect(manager.getPermissions("test-plugin")).toEqual([]);
      });
    });

    describe("unregisterPlugin", () => {
      it("should remove all permissions for a plugin", () => {
        manager.registerPlugin("test-plugin", ["note:read", "note:write"]);
        manager.unregisterPlugin("test-plugin");

        expect(manager.hasPermission("test-plugin", "note:read")).toBe(false);
        expect(manager.getPermissions("test-plugin")).toEqual([]);
      });
    });

    describe("hasPermission", () => {
      beforeEach(() => {
        manager.registerPlugin("test-plugin", ["note:read", "config:write"]);
      });

      it("should return true for granted permissions", () => {
        expect(manager.hasPermission("test-plugin", "note:read")).toBe(true);
        expect(manager.hasPermission("test-plugin", "config:write")).toBe(true);
      });

      it("should return false for non-granted permissions", () => {
        expect(manager.hasPermission("test-plugin", "note:write")).toBe(false);
        expect(manager.hasPermission("test-plugin", "admin:read")).toBe(false);
      });

      it("should return false for unknown plugins", () => {
        expect(manager.hasPermission("unknown-plugin", "note:read")).toBe(false);
      });
    });

    describe("hasAnyPermission", () => {
      beforeEach(() => {
        manager.registerPlugin("test-plugin", ["note:read"]);
      });

      it("should return true if plugin has any of the permissions", () => {
        expect(
          manager.hasAnyPermission("test-plugin", ["note:read", "note:write"])
        ).toBe(true);
      });

      it("should return false if plugin has none of the permissions", () => {
        expect(
          manager.hasAnyPermission("test-plugin", ["user:read", "admin:write"])
        ).toBe(false);
      });
    });

    describe("hasAllPermissions", () => {
      beforeEach(() => {
        manager.registerPlugin("test-plugin", ["note:read", "note:write"]);
      });

      it("should return true if plugin has all permissions", () => {
        expect(
          manager.hasAllPermissions("test-plugin", ["note:read", "note:write"])
        ).toBe(true);
      });

      it("should return false if plugin is missing any permission", () => {
        expect(
          manager.hasAllPermissions("test-plugin", ["note:read", "user:read"])
        ).toBe(false);
      });
    });

    describe("assertPermission", () => {
      beforeEach(() => {
        manager.registerPlugin("test-plugin", ["note:read"]);
      });

      it("should not throw for granted permissions", () => {
        expect(() => {
          manager.assertPermission("test-plugin", "note:read");
        }).not.toThrow();
      });

      it("should throw PluginPermissionError for non-granted permissions", () => {
        expect(() => {
          manager.assertPermission("test-plugin", "note:write");
        }).toThrow(PluginPermissionError);
      });

      it("should include correct details in error", () => {
        try {
          manager.assertPermission("test-plugin", "admin:write");
        } catch (e) {
          expect(e).toBeInstanceOf(PluginPermissionError);
          const error = e as PluginPermissionError;
          expect(error.pluginId).toBe("test-plugin");
          expect(error.permission).toBe("admin:write");
        }
      });
    });

    describe("getPermissions", () => {
      it("should return all registered permissions for a plugin", () => {
        const permissions: PluginPermission[] = ["note:read", "note:write", "config:read"];
        manager.registerPlugin("test-plugin", permissions);

        const result = manager.getPermissions("test-plugin");
        expect(result.sort()).toEqual(permissions.sort());
      });

      it("should return empty array for unknown plugins", () => {
        expect(manager.getPermissions("unknown-plugin")).toEqual([]);
      });
    });

    describe("validateManifestPermissions", () => {
      it("should validate a manifest with valid permissions", () => {
        const manifest: PluginManifest = {
          id: "test-plugin",
          name: "Test Plugin",
          version: "1.0.0",
          permissions: ["note:read", "config:read"],
        };

        const result = manager.validateManifestPermissions(manifest);

        expect(result.valid).toBe(true);
        expect(result.errors).toEqual([]);
        expect(result.highRiskPermissions).toEqual([]);
      });

      it("should return errors for invalid permissions", () => {
        const manifest: PluginManifest = {
          id: "test-plugin",
          name: "Test Plugin",
          version: "1.0.0",
          permissions: ["note:read", "invalid:permission" as PluginPermission],
        };

        const result = manager.validateManifestPermissions(manifest);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it("should identify high-risk permissions", () => {
        const manifest: PluginManifest = {
          id: "test-plugin",
          name: "Test Plugin",
          version: "1.0.0",
          permissions: ["admin:write", "user:write"],
        };

        const result = manager.validateManifestPermissions(manifest);

        expect(result.highRiskPermissions).toContain("admin:write");
        expect(result.highRiskPermissions).toContain("user:write");
      });

      it("should warn about dangerous permission combinations", () => {
        const manifest: PluginManifest = {
          id: "test-plugin",
          name: "Test Plugin",
          version: "1.0.0",
          permissions: ["admin:write", "user:write"],
        };

        const result = manager.validateManifestPermissions(manifest);

        expect(result.warnings.some((w) => w.includes("powerful combination"))).toBe(
          true
        );
      });

      it("should handle manifest with no permissions", () => {
        const manifest: PluginManifest = {
          id: "test-plugin",
          name: "Test Plugin",
          version: "1.0.0",
        };

        const result = manager.validateManifestPermissions(manifest);

        expect(result.valid).toBe(true);
        expect(result.warnings.some((w) => w.includes("no permissions"))).toBe(true);
      });
    });

    describe("clear", () => {
      it("should remove all registered plugins", () => {
        manager.registerPlugin("plugin-1", ["note:read"]);
        manager.registerPlugin("plugin-2", ["user:read"]);

        manager.clear();

        expect(manager.getPermissions("plugin-1")).toEqual([]);
        expect(manager.getPermissions("plugin-2")).toEqual([]);
      });
    });
  });

  describe("PluginPermissionError", () => {
    it("should have correct name and properties", () => {
      const error = new PluginPermissionError(
        "Permission denied",
        "test-plugin",
        "note:write"
      );

      expect(error.name).toBe("PluginPermissionError");
      expect(error.message).toBe("Permission denied");
      expect(error.pluginId).toBe("test-plugin");
      expect(error.permission).toBe("note:write");
    });
  });

  describe("PERMISSION_RISK_LEVELS", () => {
    it("should classify admin:write and user:write as high risk", () => {
      expect(PERMISSION_RISK_LEVELS["admin:write"]).toBe("high");
      expect(PERMISSION_RISK_LEVELS["user:write"]).toBe("high");
    });

    it("should classify read permissions as low risk", () => {
      expect(PERMISSION_RISK_LEVELS["note:read"]).toBe("low");
      expect(PERMISSION_RISK_LEVELS["user:read"]).toBe("low");
      expect(PERMISSION_RISK_LEVELS["config:read"]).toBe("low");
    });
  });

  describe("ALL_PERMISSIONS", () => {
    it("should contain all expected permissions", () => {
      expect(ALL_PERMISSIONS).toContain("note:read");
      expect(ALL_PERMISSIONS).toContain("note:write");
      expect(ALL_PERMISSIONS).toContain("user:read");
      expect(ALL_PERMISSIONS).toContain("user:write");
      expect(ALL_PERMISSIONS).toContain("file:read");
      expect(ALL_PERMISSIONS).toContain("file:write");
      expect(ALL_PERMISSIONS).toContain("admin:read");
      expect(ALL_PERMISSIONS).toContain("admin:write");
      expect(ALL_PERMISSIONS).toContain("config:read");
      expect(ALL_PERMISSIONS).toContain("config:write");
    });

    it("should have exactly 10 permissions", () => {
      expect(ALL_PERMISSIONS.length).toBe(10);
    });
  });
});
