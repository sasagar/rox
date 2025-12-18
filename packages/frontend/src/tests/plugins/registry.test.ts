/**
 * Frontend Plugin Registry Tests
 *
 * Tests for the frontend plugin registration, slot management,
 * and lifecycle hooks.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import { pluginRegistry } from "../../lib/plugins/registry";
import type { FrontendPlugin } from "../../lib/plugins/types";

describe("FrontendPluginRegistry", () => {
  beforeEach(() => {
    // Clear registry between tests
    pluginRegistry.clear();
  });

  describe("register", () => {
    it("should register a valid plugin", async () => {
      const plugin: FrontendPlugin = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
      };

      const result = await pluginRegistry.register(plugin);

      expect(result.success).toBe(true);
      expect(result.id).toBe("test-plugin");
      expect(pluginRegistry.hasPlugin("test-plugin")).toBe(true);
    });

    it("should call onLoad when registering", async () => {
      let loadCalled = false;

      const plugin: FrontendPlugin = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        onLoad: () => {
          loadCalled = true;
        },
      };

      await pluginRegistry.register(plugin);

      expect(loadCalled).toBe(true);
    });

    it("should return error for duplicate plugin", async () => {
      const plugin: FrontendPlugin = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
      };

      await pluginRegistry.register(plugin);
      const result = await pluginRegistry.register(plugin);

      expect(result.success).toBe(false);
      expect(result.error).toContain("already registered");
    });

    it("should handle onLoad errors gracefully", async () => {
      const plugin: FrontendPlugin = {
        id: "error-plugin",
        name: "Error Plugin",
        version: "1.0.0",
        onLoad: () => {
          throw new Error("Load failed");
        },
      };

      const result = await pluginRegistry.register(plugin);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Load failed");
    });
  });

  describe("unregister", () => {
    it("should unregister an existing plugin", async () => {
      const plugin: FrontendPlugin = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
      };

      await pluginRegistry.register(plugin);
      const result = await pluginRegistry.unregister("test-plugin");

      expect(result).toBe(true);
      expect(pluginRegistry.hasPlugin("test-plugin")).toBe(false);
    });

    it("should call onUnload when unregistering", async () => {
      let unloadCalled = false;

      const plugin: FrontendPlugin = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
        onUnload: () => {
          unloadCalled = true;
        },
      };

      await pluginRegistry.register(plugin);
      await pluginRegistry.unregister("test-plugin");

      expect(unloadCalled).toBe(true);
    });

    it("should return false for non-existent plugin", async () => {
      const result = await pluginRegistry.unregister("non-existent");
      expect(result).toBe(false);
    });
  });

  describe("enable/disable", () => {
    it("should disable an enabled plugin", async () => {
      const plugin: FrontendPlugin = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
      };

      await pluginRegistry.register(plugin);
      pluginRegistry.disable("test-plugin");

      const loadedPlugin = pluginRegistry.getPlugin("test-plugin");
      expect(loadedPlugin?.enabled).toBe(false);
    });

    it("should enable a disabled plugin", async () => {
      const plugin: FrontendPlugin = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
      };

      await pluginRegistry.register(plugin);
      pluginRegistry.disable("test-plugin");
      pluginRegistry.enable("test-plugin");

      const loadedPlugin = pluginRegistry.getPlugin("test-plugin");
      expect(loadedPlugin?.enabled).toBe(true);
    });

    it("should filter disabled plugins from getEnabledPlugins", async () => {
      const plugin1: FrontendPlugin = {
        id: "plugin-1",
        name: "Plugin 1",
        version: "1.0.0",
      };
      const plugin2: FrontendPlugin = {
        id: "plugin-2",
        name: "Plugin 2",
        version: "1.0.0",
      };

      await pluginRegistry.register(plugin1);
      await pluginRegistry.register(plugin2);
      pluginRegistry.disable("plugin-1");

      const enabledPlugins = pluginRegistry.getEnabledPlugins();
      expect(enabledPlugins.length).toBe(1);
      expect(enabledPlugins[0].id).toBe("plugin-2");
    });
  });

  describe("getPlugins", () => {
    it("should return all registered plugins", async () => {
      const plugin1: FrontendPlugin = {
        id: "plugin-1",
        name: "Plugin 1",
        version: "1.0.0",
      };
      const plugin2: FrontendPlugin = {
        id: "plugin-2",
        name: "Plugin 2",
        version: "1.0.0",
      };

      await pluginRegistry.register(plugin1);
      await pluginRegistry.register(plugin2);

      const plugins = pluginRegistry.getPlugins();
      expect(plugins.length).toBe(2);
    });

    it("should return empty array when no plugins registered", () => {
      const plugins = pluginRegistry.getPlugins();
      expect(plugins.length).toBe(0);
    });
  });

  describe("clear", () => {
    it("should remove all plugins", async () => {
      const plugin: FrontendPlugin = {
        id: "test-plugin",
        name: "Test Plugin",
        version: "1.0.0",
      };

      await pluginRegistry.register(plugin);
      pluginRegistry.clear();

      expect(pluginRegistry.getPlugins().length).toBe(0);
    });
  });
});
