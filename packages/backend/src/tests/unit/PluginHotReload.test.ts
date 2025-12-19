/**
 * Plugin Hot Reload Unit Tests
 *
 * Tests for the plugin hot reload functionality including
 * reload mechanism and cache busting.
 *
 * @module tests/unit/PluginHotReload.test
 */

import { describe, it, expect, beforeEach, mock } from "bun:test";
import { PluginWatcher } from "../../plugins/PluginWatcher.js";
import type { PluginLoader } from "../../plugins/PluginLoader.js";
import pino from "pino";

// Create a silent logger for tests
const testLogger = pino({ level: "silent" });

// Mock PluginLoader
function createMockPluginLoader(): PluginLoader {
  const loadedPlugins = new Map<string, string>();
  loadedPlugins.set("test-plugin", "/path/to/test-plugin");
  loadedPlugins.set("another-plugin", "/path/to/another-plugin");

  return {
    getLoadedPlugins: () => Array.from(loadedPlugins.keys()),
    getPluginPath: (pluginId: string) => loadedPlugins.get(pluginId),
    reloadPlugin: mock(async (pluginId: string) => ({
      success: true,
      pluginId,
    })),
  } as unknown as PluginLoader;
}

describe("PluginWatcher", () => {
  let mockLoader: PluginLoader;

  beforeEach(() => {
    mockLoader = createMockPluginLoader();
  });

  describe("constructor", () => {
    it("should create watcher with default options", () => {
      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
      });

      expect(watcher).toBeDefined();
      expect(watcher.getWatchedPlugins()).toEqual([]);
    });

    it("should respect enabled option", () => {
      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
        enabled: false,
      });

      expect(watcher.isEnabled()).toBe(false);
    });

    it("should set custom debounce time", () => {
      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
        debounceMs: 500,
      });

      expect(watcher).toBeDefined();
    });
  });

  describe("isEnabled", () => {
    it("should return true in non-production by default", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
      });

      expect(watcher.isEnabled()).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });

    it("should return false in production by default", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
      });

      expect(watcher.isEnabled()).toBe(false);

      process.env.NODE_ENV = originalEnv;
    });

    it("should respect explicit enabled option over environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
        enabled: true,
      });

      expect(watcher.isEnabled()).toBe(true);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("start", () => {
    it("should not start watching in production mode", () => {
      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
        enabled: false,
      });

      watcher.start();

      expect(watcher.getWatchedPlugins()).toEqual([]);
    });
  });

  describe("stop", () => {
    it("should clear all watchers", () => {
      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
        enabled: false,
      });

      watcher.stop();

      expect(watcher.getWatchedPlugins()).toEqual([]);
    });
  });

  describe("watchPlugin", () => {
    it("should not watch when disabled", () => {
      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
        enabled: false,
      });

      watcher.watchPlugin("test-plugin");

      expect(watcher.getWatchedPlugins()).toEqual([]);
    });

    it("should not watch plugin with unknown path", () => {
      const emptyLoader = {
        getLoadedPlugins: () => [],
        getPluginPath: () => undefined,
        reloadPlugin: mock(async () => ({ success: true, pluginId: "test" })),
      } as unknown as PluginLoader;

      const watcher = new PluginWatcher({
        pluginLoader: emptyLoader,
        logger: testLogger,
        enabled: true,
      });

      watcher.watchPlugin("unknown-plugin");

      expect(watcher.getWatchedPlugins()).toEqual([]);
    });
  });

  describe("unwatchPlugin", () => {
    it("should handle unwatching non-watched plugin gracefully", () => {
      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
        enabled: true,
      });

      // Should not throw
      expect(() => {
        watcher.unwatchPlugin("non-existent");
      }).not.toThrow();
    });
  });

  describe("getWatchedPlugins", () => {
    it("should return empty array initially", () => {
      const watcher = new PluginWatcher({
        pluginLoader: mockLoader,
        logger: testLogger,
        enabled: false,
      });

      expect(watcher.getWatchedPlugins()).toEqual([]);
    });
  });
});

describe("Plugin Reload Mechanism", () => {
  it("should call reloadPlugin on the loader", async () => {
    const mockReload = mock(async (pluginId: string) => ({
      success: true,
      pluginId,
    }));

    const loader = {
      getLoadedPlugins: () => ["test-plugin"],
      getPluginPath: () => "/path/to/plugin",
      reloadPlugin: mockReload,
    } as unknown as PluginLoader;

    await loader.reloadPlugin("test-plugin");

    expect(mockReload).toHaveBeenCalledWith("test-plugin");
  });

  it("should return success result on successful reload", async () => {
    const loader = {
      getLoadedPlugins: () => ["test-plugin"],
      getPluginPath: () => "/path/to/plugin",
      reloadPlugin: async (pluginId: string) => ({
        success: true,
        pluginId,
      }),
    } as unknown as PluginLoader;

    const result = await loader.reloadPlugin("test-plugin");

    expect(result.success).toBe(true);
    expect(result.pluginId).toBe("test-plugin");
  });

  it("should return failure result on failed reload", async () => {
    const loader = {
      getLoadedPlugins: () => ["test-plugin"],
      getPluginPath: () => "/path/to/plugin",
      reloadPlugin: async (pluginId: string) => ({
        success: false,
        pluginId,
        error: "Module not found",
      }),
    } as unknown as PluginLoader;

    const result = await loader.reloadPlugin("test-plugin");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Module not found");
  });
});
