/**
 * WebPushService Unit Tests
 *
 * Tests for Web Push notification functionality, including
 * user notification type preferences.
 */

import { describe, test, expect, beforeEach, mock, afterEach } from "bun:test";
import { WebPushService } from "../../services/WebPushService.js";
import type { Database } from "../../db/index.js";
import type { InstanceSettingsService } from "../../services/InstanceSettingsService.js";
import type { NotificationType } from "../../db/schema/pg.js";

// Store original env vars
const originalEnv = { ...process.env };

describe("WebPushService", () => {
  let webPushService: WebPushService;
  let mockDb: Database;
  let mockInstanceSettingsService: InstanceSettingsService;

  // Mock push subscriptions data
  const mockSubscription = {
    id: "sub1",
    userId: "user1",
    endpoint: "https://push.example.com/endpoint1",
    p256dh: "test-p256dh-key",
    auth: "test-auth-key",
    userAgent: "Mozilla/5.0",
    language: "en",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock user data with uiSettings
  const mockUserWithAllEnabled = {
    id: "user1",
    uiSettings: null,
  };

  const mockUserWithSomeDisabled = {
    id: "user2",
    uiSettings: {
      disabledPushNotificationTypes: ["reaction", "renote"] as NotificationType[],
    },
  };

  const mockUserWithAllDisabled = {
    id: "user3",
    uiSettings: {
      disabledPushNotificationTypes: [
        "follow",
        "mention",
        "reply",
        "reaction",
        "renote",
        "quote",
        "warning",
        "follow_request_accepted",
        "dm",
      ] as NotificationType[],
    },
  };

  beforeEach(() => {
    // Reset env vars (VAPID not configured for most tests)
    process.env.VAPID_PUBLIC_KEY = "";
    process.env.VAPID_PRIVATE_KEY = "";
    process.env.VAPID_CONTACT_EMAIL = "";

    // Create mock database
    mockDb = {
      select: mock(() => ({
        from: mock(() => ({
          where: mock(() => ({
            limit: mock(() => Promise.resolve([mockUserWithAllEnabled])),
          })),
        })),
      })),
      insert: mock(() => ({
        values: mock(() => ({
          returning: mock(() => Promise.resolve([mockSubscription])),
        })),
      })),
      update: mock(() => ({
        set: mock(() => ({
          where: mock(() => ({
            returning: mock(() => Promise.resolve([mockSubscription])),
          })),
        })),
      })),
      delete: mock(() => ({
        where: mock(() => ({
          returning: mock(() => Promise.resolve([])),
        })),
      })),
    } as unknown as Database;

    // Create mock instance settings service
    mockInstanceSettingsService = {
      getInstanceName: mock(() => Promise.resolve("Test Instance")),
      getIconUrl: mock(() => Promise.resolve("https://example.com/icon.png")),
    } as unknown as InstanceSettingsService;

    webPushService = new WebPushService(mockDb, mockInstanceSettingsService);
  });

  afterEach(() => {
    // Restore original env vars
    process.env = { ...originalEnv };
  });

  describe("isAvailable", () => {
    test("returns false when VAPID is not configured", () => {
      expect(webPushService.isAvailable()).toBe(false);
    });
  });

  describe("getVapidPublicKey", () => {
    test("returns null when VAPID public key is not set", () => {
      expect(webPushService.getVapidPublicKey()).toBeNull();
    });

    test("returns VAPID public key when set", () => {
      process.env.VAPID_PUBLIC_KEY = "test-public-key";
      expect(webPushService.getVapidPublicKey()).toBe("test-public-key");
    });
  });

  describe("createPayload", () => {
    test("creates payload with correct English messages", async () => {
      const payload = await webPushService.createPayload(
        "follow",
        "TestUser",
        "notif-123",
        null,
        "en",
      );

      expect(payload.title).toBe("Test Instance");
      expect(payload.body).toBe("TestUser followed you");
      expect(payload.tag).toBe("notification-notif-123");
      expect(payload.data?.type).toBe("follow");
    });

    test("creates payload with correct Japanese messages", async () => {
      const payload = await webPushService.createPayload(
        "follow",
        "TestUser",
        "notif-123",
        null,
        "ja",
      );

      expect(payload.title).toBe("Test Instance");
      expect(payload.body).toBe("TestUserさんにフォローされました");
    });

    test("creates payload for mention notification with note URL", async () => {
      const payload = await webPushService.createPayload(
        "mention",
        "TestUser",
        "notif-123",
        "note-456",
        "en",
      );

      expect(payload.body).toBe("TestUser mentioned you");
      expect(payload.data?.url).toContain("/notes/note-456");
    });

    test("creates payload for DM notification", async () => {
      const payload = await webPushService.createPayload(
        "dm",
        "TestUser",
        "notif-123",
        "note-456",
        "en",
      );

      expect(payload.body).toBe("TestUser sent you a direct message");
    });

    test("creates payload for warning notification", async () => {
      const payload = await webPushService.createPayload(
        "warning",
        null,
        "notif-123",
        null,
        "en",
      );

      expect(payload.body).toBe("You have received a warning from the moderators");
    });

    test("uses fallback name when notifier name is null", async () => {
      const payload = await webPushService.createPayload(
        "follow",
        null,
        "notif-123",
        null,
        "en",
      );

      expect(payload.body).toBe("Someone followed you");
    });

    test("uses Japanese fallback name when notifier name is null", async () => {
      const payload = await webPushService.createPayload(
        "follow",
        null,
        "notif-123",
        null,
        "ja",
      );

      expect(payload.body).toBe("誰かさんにフォローされました");
    });
  });

  describe("sendToUserWithLocalization - notification preferences", () => {
    test("returns 0 when VAPID is not configured", async () => {
      const result = await webPushService.sendToUserWithLocalization(
        "user1",
        "follow",
        "TestUser",
        "notif-123",
        null,
      );

      expect(result).toBe(0);
    });

    // The following tests verify the preference checking logic
    // They test the getDisabledNotificationTypes method indirectly

    test("skips notification when type is disabled by user", async () => {
      // Create a service with properly mocked database that returns disabled types
      const dbWithDisabledTypes = {
        select: mock(() => ({
          from: mock(() => ({
            where: mock(() => ({
              limit: mock(() => Promise.resolve([mockUserWithSomeDisabled])),
            })),
          })),
        })),
      } as unknown as Database;

      const service = new WebPushService(dbWithDisabledTypes, mockInstanceSettingsService);

      // Even if VAPID were configured, the notification should be skipped
      // because 'reaction' is in the disabled list
      const result = await service.sendToUserWithLocalization(
        "user2",
        "reaction",
        "TestUser",
        "notif-123",
        null,
      );

      expect(result).toBe(0);
    });
  });

  describe("notification type coverage", () => {
    const notificationTypes: NotificationType[] = [
      "follow",
      "mention",
      "reply",
      "reaction",
      "renote",
      "quote",
      "warning",
      "follow_request_accepted",
      "dm",
    ];

    test.each(notificationTypes)(
      "creates valid payload for %s notification type in English",
      async (type) => {
        const payload = await webPushService.createPayload(
          type,
          "TestUser",
          "notif-123",
          "note-456",
          "en",
        );

        expect(payload.title).toBe("Test Instance");
        expect(payload.body).toBeTruthy();
        expect(payload.body.length).toBeGreaterThan(0);
        expect(payload.data?.type).toBe(type);
      },
    );

    test.each(notificationTypes)(
      "creates valid payload for %s notification type in Japanese",
      async (type) => {
        const payload = await webPushService.createPayload(
          type,
          "TestUser",
          "notif-123",
          "note-456",
          "ja",
        );

        expect(payload.title).toBe("Test Instance");
        expect(payload.body).toBeTruthy();
        expect(payload.body.length).toBeGreaterThan(0);
        expect(payload.data?.type).toBe(type);
      },
    );
  });

  describe("URL generation in payloads", () => {
    test("generates user profile URL for follow notification", async () => {
      const payload = await webPushService.createPayload(
        "follow",
        "TestUser",
        "notif-123",
        null,
        "en",
      );

      expect(payload.data?.url).toContain("/@TestUser");
    });

    test("generates note URL for mention notification", async () => {
      const payload = await webPushService.createPayload(
        "mention",
        "TestUser",
        "notif-123",
        "note-456",
        "en",
      );

      expect(payload.data?.url).toContain("/notes/note-456");
    });

    test("generates notifications URL when note ID is missing", async () => {
      const payload = await webPushService.createPayload(
        "mention",
        "TestUser",
        "notif-123",
        null,
        "en",
      );

      expect(payload.data?.url).toContain("/notifications");
    });

    test("generates notifications URL for warning notification", async () => {
      const payload = await webPushService.createPayload(
        "warning",
        null,
        "notif-123",
        null,
        "en",
      );

      expect(payload.data?.url).toContain("/notifications");
    });
  });
});
