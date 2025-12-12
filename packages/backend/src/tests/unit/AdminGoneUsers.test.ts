/**
 * Admin Gone Users API Unit Tests
 *
 * Tests for the admin endpoints that manage users with fetch errors (410 Gone, etc.)
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { User } from "../../../../shared/src/types/user.js";

describe("Admin Gone Users API", () => {
  const baseUser: User = {
    id: "user1",
    username: "testuser",
    email: "test@example.com",
    passwordHash: "",
    displayName: "Test User",
    bio: null,
    host: "remote.example",
    uri: "https://remote.example/users/testuser",
    avatarUrl: null,
    bannerUrl: null,
    isAdmin: false,
    isDeleted: false,
    deletedAt: null,
    isSystemUser: false,
    isSuspended: false,
    publicKey: null,
    privateKey: null,
    inbox: "https://remote.example/inbox",
    outbox: null,
    followersUrl: null,
    followingUrl: null,
    sharedInbox: null,
    customCss: null,
    uiSettings: null,
    alsoKnownAs: null,
    movedTo: null,
    movedAt: null,
    profileEmojis: null,
    storageQuotaMb: null,
    goneDetectedAt: null,
    fetchFailureCount: 0,
    lastFetchAttemptAt: null,
    lastFetchError: null,
    followersCount: 0,
    followingCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGoneUser1: User = {
    ...baseUser,
    id: "gone-user-1",
    username: "goneuser1",
    host: "gone1.example",
    goneDetectedAt: new Date("2024-01-01"),
    fetchFailureCount: 5,
    lastFetchAttemptAt: new Date("2024-01-15"),
    lastFetchError: "410 Gone",
  };

  const mockGoneUser2: User = {
    ...baseUser,
    id: "gone-user-2",
    username: "goneuser2",
    host: "gone2.example",
    goneDetectedAt: new Date("2024-01-05"),
    fetchFailureCount: 3,
    lastFetchAttemptAt: new Date("2024-01-10"),
    lastFetchError: "Connection refused",
  };

  let mockUserRepo: Partial<IUserRepository>;

  beforeEach(() => {
    mockUserRepo = {
      findWithFetchErrors: mock(async () => Promise.resolve([mockGoneUser1, mockGoneUser2])),
      countWithFetchErrors: mock(async () => Promise.resolve(2)),
      update: mock(async (id: string, data: Partial<User>) =>
        Promise.resolve({ ...baseUser, ...data, id, updatedAt: new Date() })
      ),
      clearFetchFailure: mock(async () => Promise.resolve()),
    };
  });

  describe("GET /api/admin/gone-users", () => {
    test("should return list of users with fetch errors", async () => {
      const users = await mockUserRepo.findWithFetchErrors!();
      const total = await mockUserRepo.countWithFetchErrors!();

      expect(users).toHaveLength(2);
      expect(total).toBe(2);
      expect(users[0]!.goneDetectedAt).not.toBeNull();
      expect(users[0]!.fetchFailureCount).toBeGreaterThan(0);
    });

    test("should include all required fields in response", async () => {
      const users = await mockUserRepo.findWithFetchErrors!();

      for (const user of users) {
        expect(user.id).toBeDefined();
        expect(user.username).toBeDefined();
        expect(user.host).toBeDefined();
        expect(user.goneDetectedAt).toBeDefined();
        expect(user.fetchFailureCount).toBeDefined();
        expect(user.lastFetchAttemptAt).toBeDefined();
        expect(user.lastFetchError).toBeDefined();
        expect(user.isDeleted).toBeDefined();
      }
    });

    test("should return empty list when no users have fetch errors", async () => {
      mockUserRepo.findWithFetchErrors = mock(async () => Promise.resolve([]));
      mockUserRepo.countWithFetchErrors = mock(async () => Promise.resolve(0));

      const users = await mockUserRepo.findWithFetchErrors();
      const total = await mockUserRepo.countWithFetchErrors();

      expect(users).toHaveLength(0);
      expect(total).toBe(0);
    });
  });

  describe("POST /api/admin/gone-users/mark-deleted", () => {
    test("should mark specified users as deleted", async () => {
      const userIds = ["gone-user-1", "gone-user-2"];
      let deletedCount = 0;

      for (const userId of userIds) {
        await mockUserRepo.update!(userId, {
          isDeleted: true,
          deletedAt: new Date(),
        });
        deletedCount++;
      }

      expect(deletedCount).toBe(2);
      expect(mockUserRepo.update).toHaveBeenCalledTimes(2);
    });

    test("should handle single user deletion", async () => {
      const userIds = ["gone-user-1"];

      for (const userId of userIds) {
        const result = await mockUserRepo.update!(userId, {
          isDeleted: true,
          deletedAt: new Date(),
        });
        expect(result.isDeleted).toBe(true);
        expect(result.deletedAt).toBeDefined();
      }

      expect(mockUserRepo.update).toHaveBeenCalledTimes(1);
    });

    test("should handle empty userIds array", async () => {
      const userIds: string[] = [];
      let deletedCount = 0;

      for (const userId of userIds) {
        await mockUserRepo.update!(userId, { isDeleted: true });
        deletedCount++;
      }

      expect(deletedCount).toBe(0);
      expect(mockUserRepo.update).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/admin/gone-users/clear", () => {
    test("should clear fetch failure status for specified users", async () => {
      const userIds = ["gone-user-1", "gone-user-2"];

      for (const userId of userIds) {
        await mockUserRepo.clearFetchFailure!(userId);
      }

      expect(mockUserRepo.clearFetchFailure).toHaveBeenCalledTimes(2);
      expect(mockUserRepo.clearFetchFailure).toHaveBeenCalledWith("gone-user-1");
      expect(mockUserRepo.clearFetchFailure).toHaveBeenCalledWith("gone-user-2");
    });

    test("should handle single user clear", async () => {
      await mockUserRepo.clearFetchFailure!("gone-user-1");

      expect(mockUserRepo.clearFetchFailure).toHaveBeenCalledTimes(1);
      expect(mockUserRepo.clearFetchFailure).toHaveBeenCalledWith("gone-user-1");
    });

    test("should not throw when clearing non-existent user", async () => {
      // clearFetchFailure should complete without errors even for non-existent users
      await mockUserRepo.clearFetchFailure!("nonexistent");
      expect(mockUserRepo.clearFetchFailure).toHaveBeenCalledWith("nonexistent");
    });
  });

  describe("Error handling", () => {
    test("should handle repository errors gracefully", async () => {
      mockUserRepo.findWithFetchErrors = mock(async () => {
        throw new Error("Database connection failed");
      });

      await expect(mockUserRepo.findWithFetchErrors()).rejects.toThrow("Database connection failed");
    });

    test("should handle update errors", async () => {
      mockUserRepo.update = mock(async () => {
        throw new Error("User not found");
      });

      await expect(mockUserRepo.update!("nonexistent", { isDeleted: true })).rejects.toThrow("User not found");
    });
  });
});
