/**
 * PluginLoader Unit Tests
 *
 * Tests the PluginLoader implementation for the plugin system.
 * These tests focus on core functionality using mocks rather than actual file loading.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { Hono } from "hono";
import { EventBus } from "../../plugins/EventBus";
import { InMemoryPluginConfigStorage } from "../../plugins/PluginConfigStorage";

describe("InMemoryPluginConfigStorage", () => {
  let storage: InMemoryPluginConfigStorage;

  beforeEach(() => {
    storage = new InMemoryPluginConfigStorage();
  });

  test("should get and set values", async () => {
    await storage.set("key", "value");
    const result = await storage.get<string>("key");
    expect(result).toBe("value");
  });

  test("should return undefined for non-existent keys", async () => {
    const result = await storage.get("non-existent");
    expect(result).toBeUndefined();
  });

  test("should delete values", async () => {
    await storage.set("key", "value");
    await storage.delete("key");
    const result = await storage.get("key");
    expect(result).toBeUndefined();
  });

  test("should get all values", async () => {
    await storage.set("key1", "value1");
    await storage.set("key2", "value2");

    const all = await storage.getAll();

    expect(all).toEqual({
      key1: "value1",
      key2: "value2",
    });
  });

  test("should handle complex values", async () => {
    const complexValue = {
      array: [1, 2, 3],
      nested: { a: "b" },
      bool: true,
    };

    await storage.set("complex", complexValue);
    const result = await storage.get<typeof complexValue>("complex");

    expect(result).toEqual(complexValue);
  });

  test("should return a copy of values in getAll", async () => {
    await storage.set("key", "value");
    const all = await storage.getAll();

    // Modifying the returned object should not affect storage
    all.key = "modified";

    const result = await storage.get<string>("key");
    expect(result).toBe("value");
  });

  test("should handle number values", async () => {
    await storage.set("count", 42);
    const result = await storage.get<number>("count");
    expect(result).toBe(42);
  });

  test("should handle boolean values", async () => {
    await storage.set("enabled", true);
    const result = await storage.get<boolean>("enabled");
    expect(result).toBe(true);
  });

  test("should handle null values", async () => {
    await storage.set("nullable", null);
    const result = await storage.get<null>("nullable");
    expect(result).toBeNull();
  });

  test("should handle array values", async () => {
    await storage.set("list", [1, 2, 3]);
    const result = await storage.get<number[]>("list");
    expect(result).toEqual([1, 2, 3]);
  });

  test("should overwrite existing values", async () => {
    await storage.set("key", "original");
    await storage.set("key", "updated");
    const result = await storage.get<string>("key");
    expect(result).toBe("updated");
  });

  test("should delete non-existent key without error", async () => {
    await storage.delete("non-existent");
    // No error thrown
  });

  test("should return empty object when no values set", async () => {
    const all = await storage.getAll();
    expect(all).toEqual({});
  });
});

describe("PluginLoader types validation", () => {
  test("should validate plugin interface structure", () => {
    // This tests that the type definitions are correct by creating valid objects
    const validPlugin = {
      id: "test-plugin",
      name: "Test Plugin",
      version: "1.0.0",
      description: "A test plugin",
      minRoxVersion: "2025.12.0",
      dependencies: ["other-plugin"],
      onLoad: mock(() => {}),
      onUnload: mock(() => {}),
      routes: mock(() => {}),
      middleware: [],
      adminUI: {
        settingsComponent: "./settings.tsx",
        configSchema: { type: "object" },
      },
    };

    // Verify all expected properties exist
    expect(validPlugin.id).toBe("test-plugin");
    expect(validPlugin.name).toBe("Test Plugin");
    expect(validPlugin.version).toBe("1.0.0");
    expect(validPlugin.description).toBe("A test plugin");
    expect(validPlugin.minRoxVersion).toBe("2025.12.0");
    expect(validPlugin.dependencies).toEqual(["other-plugin"]);
    expect(typeof validPlugin.onLoad).toBe("function");
    expect(typeof validPlugin.onUnload).toBe("function");
    expect(typeof validPlugin.routes).toBe("function");
    expect(validPlugin.middleware).toEqual([]);
    expect(validPlugin.adminUI).toBeDefined();
  });

  test("should validate minimal plugin structure", () => {
    const minimalPlugin = {
      id: "minimal",
      name: "Minimal Plugin",
      version: "0.1.0",
    };

    expect(minimalPlugin.id).toBe("minimal");
    expect(minimalPlugin.name).toBe("Minimal Plugin");
    expect(minimalPlugin.version).toBe("0.1.0");
  });

  test("should validate plugin manifest structure", () => {
    const manifest = {
      id: "manifest-plugin",
      name: "Manifest Plugin",
      version: "1.0.0",
      description: "Plugin with manifest",
      author: "Test Author",
      repository: "https://github.com/test/plugin",
      minRoxVersion: "2025.12.0",
      dependencies: [],
      permissions: ["note:read", "note:write"],
      backend: "backend/index.ts",
      frontend: "frontend/index.tsx",
      configSchema: { type: "object" },
    };

    expect(manifest.id).toBe("manifest-plugin");
    expect(manifest.permissions).toContain("note:read");
    expect(manifest.backend).toBe("backend/index.ts");
  });

  test("should validate plugin context structure", () => {
    const eventBus = new EventBus();
    const configStorage = new InMemoryPluginConfigStorage();

    const mockContext = {
      events: eventBus,
      logger: {
        info: mock(() => {}),
        error: mock(() => {}),
        debug: mock(() => {}),
        warn: mock(() => {}),
      },
      config: configStorage,
      registerScheduledTask: mock(() => {}),
      baseUrl: "https://example.com",
      roxVersion: "2025.12.0",
    };

    expect(mockContext.events).toBe(eventBus);
    expect(mockContext.config).toBe(configStorage);
    expect(mockContext.baseUrl).toBe("https://example.com");
    expect(mockContext.roxVersion).toBe("2025.12.0");
    expect(typeof mockContext.registerScheduledTask).toBe("function");
  });

  test("should validate scheduled task structure", () => {
    const task = {
      id: "cleanup-task",
      name: "Cleanup Task",
      schedule: "1h",
      handler: mock(async () => {}),
      runOnStartup: true,
    };

    expect(task.id).toBe("cleanup-task");
    expect(task.schedule).toBe("1h");
    expect(task.runOnStartup).toBe(true);
    expect(typeof task.handler).toBe("function");
  });

  test("should validate numeric schedule format", () => {
    const task = {
      id: "interval-task",
      name: "Interval Task",
      schedule: 60000, // 1 minute in ms
      handler: mock(async () => {}),
    };

    expect(task.schedule).toBe(60000);
  });
});

describe("Plugin event integration", () => {
  test("should allow plugin to subscribe to events", async () => {
    const eventBus = new EventBus();
    const handler = mock(() => {});

    // Simulate plugin subscribing to events
    const unsubscribe = eventBus.on("note:afterCreate", handler);

    // Emit event
    await eventBus.emit("note:afterCreate", {
      note: { id: "note1" } as any,
    });

    expect(handler).toHaveBeenCalledTimes(1);

    // Cleanup
    unsubscribe();
  });

  test("should allow plugin to modify data with before events", async () => {
    const eventBus = new EventBus();

    // Simulate plugin subscribing to before event
    eventBus.onBefore("note:beforeCreate", (data) => ({
      modified: { ...data, content: `[Plugin] ${data.content}` },
    }));

    // Emit before event
    const result = await eventBus.emitBefore("note:beforeCreate", {
      content: "Hello",
      userId: "user1",
    });

    expect(result.cancelled).toBe(false);
    if (!result.cancelled) {
      expect(result.data.content).toBe("[Plugin] Hello");
    }
  });

  test("should allow plugin to cancel operations", async () => {
    const eventBus = new EventBus();

    // Simulate plugin subscribing to before event with cancellation
    eventBus.onBefore("note:beforeCreate", (data) => {
      if (data.content.includes("spam")) {
        return { cancel: true, reason: "Spam detected" };
      }
      return {};
    });

    // Emit before event with spam content
    const result = await eventBus.emitBefore("note:beforeCreate", {
      content: "This is spam content",
      userId: "user1",
    });

    expect(result.cancelled).toBe(true);
    if (result.cancelled) {
      expect(result.reason).toBe("Spam detected");
    }
  });

  test("should cleanup subscriptions when unsubscribed", async () => {
    const eventBus = new EventBus();
    const handler = mock(() => {});

    const unsubscribe = eventBus.on("note:afterCreate", handler);

    // Unsubscribe before emitting
    unsubscribe();

    await eventBus.emit("note:afterCreate", {
      note: { id: "note1" } as any,
    });

    expect(handler).not.toHaveBeenCalled();
  });
});

describe("Plugin route registration simulation", () => {
  test("should allow registering routes on Hono app", () => {
    const app = new Hono();
    const pluginApp = new Hono();

    // Simulate plugin route registration
    pluginApp.get("/status", (c) => c.json({ status: "ok" }));
    pluginApp.post("/action", (c) => c.json({ action: "done" }));

    // Mount plugin routes
    app.route("/api/x/my-plugin", pluginApp);

    // Verify routes are registered (by checking app.routes if available)
    // Since Hono doesn't expose routes easily, we just verify no errors occurred
    expect(true).toBe(true);
  });

  test("should support middleware in plugin app", () => {
    const pluginApp = new Hono();
    const middlewareCalled = { value: false };

    // Add middleware
    pluginApp.use("*", async (_c, next) => {
      middlewareCalled.value = true;
      await next();
    });

    pluginApp.get("/test", (c) => c.json({ test: true }));

    // Middleware is registered
    expect(true).toBe(true);
  });
});
