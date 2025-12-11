/**
 * NodeInfo Endpoint Unit Tests
 *
 * Tests NodeInfo 2.0 and 2.1 endpoint responses
 * to ensure proper server metadata is returned.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { Hono } from "hono";
import nodeinfoApp from "../../routes/ap/nodeinfo.js";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { INoteRepository } from "../../interfaces/repositories/INoteRepository.js";
import type { IInstanceSettingsRepository, InstanceSettingKey } from "../../interfaces/repositories/IInstanceSettingsRepository.js";

/**
 * NodeInfo response structure for type safety in tests
 */
interface NodeInfoResponse {
  version: string;
  software: {
    name: string;
    version: string;
    repository?: string;
    homepage?: string;
  };
  protocols: string[];
  services: {
    inbound: string[];
    outbound: string[];
  };
  openRegistrations: boolean;
  usage: {
    users: {
      total: number;
    };
    localPosts: number;
  };
  metadata: {
    nodeName?: string;
    nodeDescription?: string;
    maintainer?: { email: string };
    tosUrl?: string;
    privacyPolicyUrl?: string;
    iconUrl?: string;
    themeColor?: string;
    langs?: string[];
    features?: string[];
  };
}

describe("NodeInfo Endpoints", () => {
  let app: Hono;
  let mockUserRepository: { count: ReturnType<typeof mock>; countActiveLocal: ReturnType<typeof mock> };
  let mockNoteRepository: { count: ReturnType<typeof mock> };
  let mockInstanceSettingsRepository: {
    get: ReturnType<typeof mock>;
    getMany: ReturnType<typeof mock>;
  };
  let settingsStore: Map<string, unknown>;

  beforeEach(() => {
    settingsStore = new Map();

    // Set default settings
    settingsStore.set("instance.name", "Test Instance");
    settingsStore.set("instance.description", "A test ActivityPub server");
    settingsStore.set("instance.maintainerEmail", "admin@test.example");
    settingsStore.set("instance.tosUrl", "https://test.example/tos");
    settingsStore.set("instance.privacyPolicyUrl", "https://test.example/privacy");
    settingsStore.set("instance.iconUrl", "https://test.example/icon.png");
    settingsStore.set("registration.enabled", true);
    settingsStore.set("theme.primaryColor", "#ff6b6b");

    mockUserRepository = {
      count: mock(() => Promise.resolve(42)),
      countActiveLocal: mock(() => Promise.resolve(10)),
    };

    mockNoteRepository = {
      count: mock(() => Promise.resolve(1234)),
    };

    mockInstanceSettingsRepository = {
      get: mock((key: InstanceSettingKey) => Promise.resolve(settingsStore.get(key) ?? null)),
      getMany: mock((keys: InstanceSettingKey[]) => {
        const result = new Map<InstanceSettingKey, unknown>();
        for (const key of keys) {
          const value = settingsStore.get(key);
          if (value !== undefined) {
            result.set(key, value);
          }
        }
        return Promise.resolve(result);
      }),
    };

    app = new Hono();

    // Add middleware to inject mock repositories
    app.use("*", async (c, next) => {
      c.set("userRepository", mockUserRepository as unknown as IUserRepository);
      c.set("noteRepository", mockNoteRepository as unknown as INoteRepository);
      c.set("instanceSettingsRepository", mockInstanceSettingsRepository as unknown as IInstanceSettingsRepository);
      await next();
    });

    app.route("/", nodeinfoApp);
  });

  describe("GET /.well-known/nodeinfo", () => {
    test("should return nodeinfo discovery document", async () => {
      const res = await app.request("/.well-known/nodeinfo", {
        headers: { Host: "test.example" },
      });

      expect(res.status).toBe(200);

      const data = await res.json() as { links: Array<{ rel: string; href: string }> };
      expect(data.links).toBeDefined();
      expect(data.links).toHaveLength(2);

      // Check 2.1 link
      const link21 = data.links.find(
        (l) => l.rel === "http://nodeinfo.diaspora.software/ns/schema/2.1"
      );
      expect(link21).toBeDefined();
      expect(link21?.href).toContain("/nodeinfo/2.1");

      // Check 2.0 link
      const link20 = data.links.find(
        (l) => l.rel === "http://nodeinfo.diaspora.software/ns/schema/2.0"
      );
      expect(link20).toBeDefined();
      expect(link20?.href).toContain("/nodeinfo/2.0");
    });
  });

  describe("GET /nodeinfo/2.1", () => {
    test("should return valid nodeinfo 2.1 response", async () => {
      const res = await app.request("/nodeinfo/2.1");

      expect(res.status).toBe(200);

      const data = await res.json() as NodeInfoResponse;

      // Version
      expect(data.version).toBe("2.1");

      // Software info
      expect(data.software.name).toBe("rox");
      expect(data.software.version).toBeDefined();
      expect(data.software.repository).toBe("https://github.com/Love-rox/rox");
      expect(data.software.homepage).toBe("https://github.com/Love-rox/rox");

      // Protocols
      expect(data.protocols).toContain("activitypub");

      // Services
      expect(data.services).toBeDefined();
      expect(data.services.inbound).toEqual([]);
      expect(data.services.outbound).toEqual([]);

      // Registration
      expect(data.openRegistrations).toBe(true);

      // Usage
      expect(data.usage.users.total).toBe(42);
      expect(data.usage.localPosts).toBe(1234);
    });

    test("should include themeColor in metadata", async () => {
      const res = await app.request("/nodeinfo/2.1");

      expect(res.status).toBe(200);

      const data = await res.json() as NodeInfoResponse;

      expect(data.metadata.themeColor).toBe("#ff6b6b");
    });

    test("should include instance metadata", async () => {
      const res = await app.request("/nodeinfo/2.1");

      expect(res.status).toBe(200);

      const data = await res.json() as NodeInfoResponse;

      expect(data.metadata.nodeName).toBe("Test Instance");
      expect(data.metadata.nodeDescription).toBe("A test ActivityPub server");
      expect(data.metadata.maintainer?.email).toBe("admin@test.example");
      expect(data.metadata.tosUrl).toBe("https://test.example/tos");
      expect(data.metadata.privacyPolicyUrl).toBe("https://test.example/privacy");
      expect(data.metadata.iconUrl).toBe("https://test.example/icon.png");
      expect(data.metadata.langs).toContain("en");
      expect(data.metadata.langs).toContain("ja");
      expect(data.metadata.features).toContain("activitypub");
    });

    test("should return default themeColor when not explicitly set", async () => {
      settingsStore.delete("theme.primaryColor");

      const res = await app.request("/nodeinfo/2.1");

      expect(res.status).toBe(200);

      const data = await res.json() as NodeInfoResponse;

      // Default primary color is #3b82f6 (blue)
      expect(data.metadata.themeColor).toBe("#3b82f6");
    });

    test("should use nodeInfoThemeColor when set (overriding primaryColor)", async () => {
      settingsStore.set("theme.nodeInfoThemeColor", "#00ff00");

      const res = await app.request("/nodeinfo/2.1");

      expect(res.status).toBe(200);

      const data = await res.json() as NodeInfoResponse;

      // Should use nodeInfoThemeColor instead of primaryColor
      expect(data.metadata.themeColor).toBe("#00ff00");
    });

    test("should fall back to primaryColor when nodeInfoThemeColor is null", async () => {
      settingsStore.set("theme.nodeInfoThemeColor", null);

      const res = await app.request("/nodeinfo/2.1");

      expect(res.status).toBe(200);

      const data = await res.json() as NodeInfoResponse;

      // Should fall back to primaryColor (#ff6b6b)
      expect(data.metadata.themeColor).toBe("#ff6b6b");
    });

    test("should handle missing count methods gracefully", async () => {
      // Remove count methods - use type assertion for test purposes
      (mockUserRepository as { count: unknown }).count = undefined;
      (mockUserRepository as { countActiveLocal: unknown }).countActiveLocal = undefined;
      (mockNoteRepository as { count: unknown }).count = undefined;

      const res = await app.request("/nodeinfo/2.1");

      expect(res.status).toBe(200);

      const data = await res.json() as NodeInfoResponse;

      // Should default to 0
      expect(data.usage.users.total).toBe(0);
      expect(data.usage.localPosts).toBe(0);
    });
  });

  describe("GET /nodeinfo/2.0", () => {
    test("should return valid nodeinfo 2.0 response", async () => {
      const res = await app.request("/nodeinfo/2.0");

      expect(res.status).toBe(200);

      const data = await res.json() as NodeInfoResponse;

      // Version
      expect(data.version).toBe("2.0");

      // Software info (2.0 doesn't have repository/homepage)
      expect(data.software.name).toBe("rox");
      expect(data.software.version).toBeDefined();
      expect(data.software.repository).toBeUndefined();

      // Protocols
      expect(data.protocols).toContain("activitypub");

      // Registration
      expect(data.openRegistrations).toBe(true);

      // Usage
      expect(data.usage.users.total).toBe(42);
      expect(data.usage.localPosts).toBe(1234);
    });

    test("should include themeColor in metadata for 2.0", async () => {
      const res = await app.request("/nodeinfo/2.0");

      expect(res.status).toBe(200);

      const data = await res.json() as NodeInfoResponse;

      expect(data.metadata.themeColor).toBe("#ff6b6b");
    });

    test("should return closed registration when disabled", async () => {
      settingsStore.set("registration.enabled", false);

      const res = await app.request("/nodeinfo/2.0");

      expect(res.status).toBe(200);

      const data = await res.json() as NodeInfoResponse;

      expect(data.openRegistrations).toBe(false);
    });
  });
});
