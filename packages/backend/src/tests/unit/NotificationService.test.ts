/**
 * NotificationService Unit Tests
 *
 * Tests for notification creation, retrieval, and management.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { NotificationService } from "../../services/NotificationService.js";
import type { INotificationRepository } from "../../interfaces/repositories/INotificationRepository.js";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { Notification, NotificationType } from "../../db/schema/pg.js";

// Mock the NotificationStreamService module
mock.module("../../services/NotificationStreamService.js", () => ({
  getNotificationStreamService: () => ({
    pushNotification: () => {},
    pushUnreadCount: () => {},
  }),
}));

describe("NotificationService", () => {
  let notificationService: NotificationService;
  let mockNotificationRepository: INotificationRepository;
  let mockUserRepository: IUserRepository;

  const mockUser = {
    id: "user1",
    username: "testuser",
    host: null,
    displayName: "Test User",
    avatarUrl: "https://example.com/avatar.png",
    email: "test@example.com",
    passwordHash: "hash",
    bio: null,
    isAdmin: false,
    isModerator: false,
    isBot: false,
    isSuspended: false,
    isDeleted: false,
    isSilenced: false,
    isLocked: false,
    publicKey: "key",
    privateKey: "private",
    uri: "https://example.com/users/testuser",
    inboxUrl: "https://example.com/users/testuser/inbox",
    sharedInboxUrl: null,
    followersUrl: "https://example.com/users/testuser/followers",
    followingUrl: "https://example.com/users/testuser/following",
    pinnedNoteIds: [],
    headerUrl: null,
    profileEmojis: [],
    fields: [],
    followersCount: 0,
    followingCount: 0,
    notesCount: 0,
    movedToUri: null,
    alsoKnownAs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    lastActiveAt: new Date(),
  };

  const createMockNotification = (overrides: Partial<Notification> = {}): Notification => ({
    id: "notif1",
    userId: "user1",
    type: "follow" as NotificationType,
    notifierId: "user2",
    noteId: null,
    reaction: null,
    warningId: null,
    entityId: null,
    isRead: false,
    createdAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockNotificationRepository = {
      create: mock(() => Promise.resolve(createMockNotification())),
      findById: mock(() => Promise.resolve(createMockNotification())),
      findByUserId: mock(() => Promise.resolve([createMockNotification()])),
      exists: mock(() => Promise.resolve(false)),
      markAsRead: mock(() => Promise.resolve(createMockNotification({ isRead: true }))),
      markAllAsReadByUserId: mock(() => Promise.resolve(1)),
      markAsReadUntil: mock(() => Promise.resolve(1)),
      delete: mock(() => Promise.resolve(true)),
      deleteAllByUserId: mock(() => Promise.resolve(5)),
      countUnreadByUserId: mock(() => Promise.resolve(3)),
    } as unknown as INotificationRepository;

    mockUserRepository = {
      findById: mock(() => Promise.resolve(mockUser)),
      findByUsername: mock(() => Promise.resolve(mockUser)),
    } as unknown as IUserRepository;

    notificationService = new NotificationService(mockNotificationRepository, mockUserRepository);
  });

  describe("createFollowNotification", () => {
    test("creates follow notification successfully", async () => {
      const notification = await notificationService.createFollowNotification("user1", "user2");

      expect(notification).not.toBeNull();
      expect(mockNotificationRepository.create).toHaveBeenCalled();
    });

    test("returns null when following yourself", async () => {
      const notification = await notificationService.createFollowNotification("user1", "user1");

      expect(notification).toBeNull();
      expect(mockNotificationRepository.create).not.toHaveBeenCalled();
    });

    test("returns null when notification already exists", async () => {
      (mockNotificationRepository.exists as ReturnType<typeof mock>).mockResolvedValue(true);

      const notification = await notificationService.createFollowNotification("user1", "user2");

      expect(notification).toBeNull();
    });
  });

  describe("createMentionNotification", () => {
    test("creates mention notification successfully", async () => {
      (mockNotificationRepository.create as ReturnType<typeof mock>).mockResolvedValue(
        createMockNotification({ type: "mention", noteId: "note1" }),
      );

      const notification = await notificationService.createMentionNotification(
        "user1",
        "user2",
        "note1",
      );

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe("mention");
      expect(notification?.noteId).toBe("note1");
    });

    test("returns null when mentioning yourself", async () => {
      const notification = await notificationService.createMentionNotification(
        "user1",
        "user1",
        "note1",
      );

      expect(notification).toBeNull();
    });
  });

  describe("createReplyNotification", () => {
    test("creates reply notification successfully", async () => {
      (mockNotificationRepository.create as ReturnType<typeof mock>).mockResolvedValue(
        createMockNotification({ type: "reply", noteId: "note1" }),
      );

      const notification = await notificationService.createReplyNotification(
        "user1",
        "user2",
        "note1",
      );

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe("reply");
    });

    test("returns null when replying to yourself", async () => {
      const notification = await notificationService.createReplyNotification(
        "user1",
        "user1",
        "note1",
      );

      expect(notification).toBeNull();
    });
  });

  describe("createReactionNotification", () => {
    test("creates reaction notification successfully", async () => {
      (mockNotificationRepository.create as ReturnType<typeof mock>).mockResolvedValue(
        createMockNotification({ type: "reaction", noteId: "note1", reaction: "👍" }),
      );

      const notification = await notificationService.createReactionNotification(
        "user1",
        "user2",
        "note1",
        "👍",
      );

      expect(notification).not.toBeNull();
      expect(notification?.reaction).toBe("👍");
    });

    test("returns null when reacting to your own note", async () => {
      const notification = await notificationService.createReactionNotification(
        "user1",
        "user1",
        "note1",
        "👍",
      );

      expect(notification).toBeNull();
    });

    test("returns null when same reaction notification already exists", async () => {
      (mockNotificationRepository.exists as ReturnType<typeof mock>).mockResolvedValue(true);

      const notification = await notificationService.createReactionNotification(
        "user1",
        "user2",
        "note1",
        "👍",
      );

      expect(notification).toBeNull();
    });
  });

  describe("createRenoteNotification", () => {
    test("creates renote notification successfully", async () => {
      (mockNotificationRepository.create as ReturnType<typeof mock>).mockResolvedValue(
        createMockNotification({ type: "renote", noteId: "renote1" }),
      );

      const notification = await notificationService.createRenoteNotification(
        "user1",
        "user2",
        "renote1",
      );

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe("renote");
    });

    test("returns null when renoting your own note", async () => {
      const notification = await notificationService.createRenoteNotification(
        "user1",
        "user1",
        "renote1",
      );

      expect(notification).toBeNull();
    });
  });

  describe("createQuoteNotification", () => {
    test("creates quote notification successfully", async () => {
      (mockNotificationRepository.create as ReturnType<typeof mock>).mockResolvedValue(
        createMockNotification({ type: "quote", noteId: "quote1" }),
      );

      const notification = await notificationService.createQuoteNotification(
        "user1",
        "user2",
        "quote1",
      );

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe("quote");
    });

    test("returns null when quoting your own note", async () => {
      const notification = await notificationService.createQuoteNotification(
        "user1",
        "user1",
        "quote1",
      );

      expect(notification).toBeNull();
    });
  });

  describe("createWarningNotification", () => {
    test("creates warning notification successfully", async () => {
      (mockNotificationRepository.create as ReturnType<typeof mock>).mockResolvedValue(
        createMockNotification({ type: "warning", warningId: "warning1" }),
      );

      const notification = await notificationService.createWarningNotification("user1", "warning1");

      expect(notification).not.toBeNull();
      expect(notification.type).toBe("warning");
    });
  });

  describe("createFollowRequestAcceptedNotification", () => {
    test("creates follow request accepted notification successfully", async () => {
      (mockNotificationRepository.create as ReturnType<typeof mock>).mockResolvedValue(
        createMockNotification({ type: "follow_request_accepted" }),
      );

      const notification = await notificationService.createFollowRequestAcceptedNotification(
        "user1",
        "user2",
      );

      expect(notification).not.toBeNull();
      expect(notification?.type).toBe("follow_request_accepted");
    });

    test("returns null when accepting your own follow request", async () => {
      const notification = await notificationService.createFollowRequestAcceptedNotification(
        "user1",
        "user1",
      );

      expect(notification).toBeNull();
    });
  });

  describe("getNotifications", () => {
    test("returns notifications with populated user data", async () => {
      // Mock findById to return user when looking up notifierId "user2"
      const notifierUser = { ...mockUser, id: "user2", username: "notifieruser" };
      (mockUserRepository.findById as ReturnType<typeof mock>).mockImplementation((id: string) =>
        Promise.resolve(id === "user2" ? notifierUser : mockUser),
      );

      const notifications = await notificationService.getNotifications("user1");

      expect(notifications).toHaveLength(1);
      expect(notifications[0]!.notifier).toBeDefined();
      expect(notifications[0]!.notifier?.username).toBe("notifieruser");
    });

    test("returns notifications without notifier when notifierId is null", async () => {
      (mockNotificationRepository.findByUserId as ReturnType<typeof mock>).mockResolvedValue([
        createMockNotification({ notifierId: null }),
      ]);

      const notifications = await notificationService.getNotifications("user1");

      expect(notifications).toHaveLength(1);
      expect(notifications[0]!.notifier).toBeNull();
    });
  });

  describe("getUnreadCount", () => {
    test("returns unread count", async () => {
      const count = await notificationService.getUnreadCount("user1");

      expect(count).toBe(3);
    });
  });

  describe("markAsRead", () => {
    test("marks notification as read", async () => {
      const notification = await notificationService.markAsRead("notif1", "user1");

      expect(notification).not.toBeNull();
      expect(notification?.isRead).toBe(true);
    });

    test("returns null when notification not found", async () => {
      (mockNotificationRepository.findById as ReturnType<typeof mock>).mockResolvedValue(null);

      const notification = await notificationService.markAsRead("notif1", "user1");

      expect(notification).toBeNull();
    });

    test("returns null when user does not own notification", async () => {
      (mockNotificationRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockNotification({ userId: "otheruser" }),
      );

      const notification = await notificationService.markAsRead("notif1", "user1");

      expect(notification).toBeNull();
    });
  });

  describe("markAllAsRead", () => {
    test("marks all notifications as read", async () => {
      const count = await notificationService.markAllAsRead("user1");

      expect(count).toBe(1);
      expect(mockNotificationRepository.markAllAsReadByUserId).toHaveBeenCalledWith("user1");
    });
  });

  describe("markAsReadUntil", () => {
    test("marks notifications as read until specified ID", async () => {
      const count = await notificationService.markAsReadUntil("user1", "notif5");

      expect(count).toBe(1);
      expect(mockNotificationRepository.markAsReadUntil).toHaveBeenCalledWith("user1", "notif5");
    });
  });

  describe("deleteNotification", () => {
    test("deletes notification successfully", async () => {
      const result = await notificationService.deleteNotification("notif1", "user1");

      expect(result).toBe(true);
    });

    test("returns false when notification not found", async () => {
      (mockNotificationRepository.findById as ReturnType<typeof mock>).mockResolvedValue(null);

      const result = await notificationService.deleteNotification("notif1", "user1");

      expect(result).toBe(false);
    });

    test("returns false when user does not own notification", async () => {
      (mockNotificationRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockNotification({ userId: "otheruser" }),
      );

      const result = await notificationService.deleteNotification("notif1", "user1");

      expect(result).toBe(false);
    });
  });

  describe("deleteAllNotifications", () => {
    test("deletes all notifications for user", async () => {
      const count = await notificationService.deleteAllNotifications("user1");

      expect(count).toBe(5);
      expect(mockNotificationRepository.deleteAllByUserId).toHaveBeenCalledWith("user1");
    });
  });
});
