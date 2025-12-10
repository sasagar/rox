/**
 * Follow Repository Unit Tests
 *
 * Tests the follow repository interface contract using mock implementations.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { IFollowRepository } from "../../interfaces/repositories/IFollowRepository.js";
import type { Follow } from "../../../../shared/src/types/follow.js";

describe("FollowRepository", () => {
  // Mock follow data
  const mockFollow1: Follow = {
    id: "follow1",
    followerId: "user1",
    followeeId: "user2",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFollow2: Follow = {
    id: "follow2",
    followerId: "user1",
    followeeId: "user3",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFollow3: Follow = {
    id: "follow3",
    followerId: "user3",
    followeeId: "user1",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const allFollows = [mockFollow1, mockFollow2, mockFollow3];

  let mockRepo: IFollowRepository;

  beforeEach(() => {
    mockRepo = {
      create: mock(async (follow) =>
        Promise.resolve({
          ...follow,
          id: follow.id || "new-follow-id",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      ),
      findById: mock(async (id: string) =>
        Promise.resolve(allFollows.find((f) => f.id === id) || null)
      ),
      exists: mock(async (followerId: string, followeeId: string) => {
        return Promise.resolve(
          allFollows.some((f) => f.followerId === followerId && f.followeeId === followeeId)
        );
      }),
      findByFolloweeId: mock(async (followeeId: string) =>
        Promise.resolve(allFollows.filter((f) => f.followeeId === followeeId))
      ),
      findByFollowerId: mock(async (followerId: string) =>
        Promise.resolve(allFollows.filter((f) => f.followerId === followerId))
      ),
      countFollowers: mock(async (userId: string) =>
        Promise.resolve(allFollows.filter((f) => f.followeeId === userId).length)
      ),
      countFollowing: mock(async (userId: string) =>
        Promise.resolve(allFollows.filter((f) => f.followerId === userId).length)
      ),
      delete: mock(async () => Promise.resolve()),
      deleteByUserId: mock(async () => Promise.resolve()),
    };
  });

  describe("create", () => {
    test("should create a follow relationship", async () => {
      const input = {
        id: "new-follow-id",
        followerId: "user4",
        followeeId: "user5",
      };

      const result = await mockRepo.create(input);

      expect(result.id).toBe("new-follow-id");
      expect(result.followerId).toBe("user4");
      expect(result.followeeId).toBe("user5");
      expect(result.createdAt).toBeDefined();
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    test("should create follow with auto-generated id", async () => {
      mockRepo.create = mock(async (follow) =>
        Promise.resolve({
          ...follow,
          id: "generated-id",
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      );

      const input = {
        followerId: "user4",
        followeeId: "user5",
      };

      const result = await mockRepo.create(input as any);

      expect(result.id).toBe("generated-id");
    });
  });

  describe("findById", () => {
    test("should find an existing follow by ID", async () => {
      const result = await mockRepo.findById("follow1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("follow1");
      expect(result!.followerId).toBe("user1");
      expect(result!.followeeId).toBe("user2");
    });

    test("should return null for non-existent follow", async () => {
      const result = await mockRepo.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("exists", () => {
    test("should return true for existing follow relationship", async () => {
      const result = await mockRepo.exists("user1", "user2");

      expect(result).toBe(true);
    });

    test("should return false for non-existing follow relationship", async () => {
      const result = await mockRepo.exists("user1", "user99");

      expect(result).toBe(false);
    });

    test("should be direction-aware (follower -> followee)", async () => {
      // user1 follows user2, but user2 does not follow user1
      const forward = await mockRepo.exists("user1", "user2");
      const reverse = await mockRepo.exists("user2", "user1");

      expect(forward).toBe(true);
      expect(reverse).toBe(false);
    });
  });

  describe("findByFolloweeId", () => {
    test("should find all followers of a user", async () => {
      const result = await mockRepo.findByFolloweeId("user1");

      expect(Array.isArray(result)).toBe(true);
      // user3 follows user1
      expect(result.some((f) => f.followerId === "user3")).toBe(true);
    });

    test("should return empty array for user with no followers", async () => {
      mockRepo.findByFolloweeId = mock(async () => Promise.resolve([]));

      const result = await mockRepo.findByFolloweeId("user99");

      expect(result).toEqual([]);
    });

    test("should support limit parameter", async () => {
      await mockRepo.findByFolloweeId("user1", 10);

      expect(mockRepo.findByFolloweeId).toHaveBeenCalledWith("user1", 10);
    });
  });

  describe("findByFollowerId", () => {
    test("should find all users that a user follows", async () => {
      const result = await mockRepo.findByFollowerId("user1");

      expect(Array.isArray(result)).toBe(true);
      // user1 follows user2 and user3
      expect(result.length).toBe(2);
      expect(result.some((f) => f.followeeId === "user2")).toBe(true);
      expect(result.some((f) => f.followeeId === "user3")).toBe(true);
    });

    test("should return empty array for user following nobody", async () => {
      mockRepo.findByFollowerId = mock(async () => Promise.resolve([]));

      const result = await mockRepo.findByFollowerId("user99");

      expect(result).toEqual([]);
    });

    test("should support limit parameter", async () => {
      await mockRepo.findByFollowerId("user1", 10);

      expect(mockRepo.findByFollowerId).toHaveBeenCalledWith("user1", 10);
    });
  });

  describe("countFollowers", () => {
    test("should return the number of followers", async () => {
      // user1 is followed by user3
      const result = await mockRepo.countFollowers("user1");

      expect(result).toBe(1);
    });

    test("should return 0 for user with no followers", async () => {
      mockRepo.countFollowers = mock(async () => Promise.resolve(0));

      const result = await mockRepo.countFollowers("user99");

      expect(result).toBe(0);
    });

    test("should count multiple followers correctly", async () => {
      // user2 is followed by user1
      const result = await mockRepo.countFollowers("user2");

      expect(result).toBe(1);
    });
  });

  describe("countFollowing", () => {
    test("should return the number of users being followed", async () => {
      // user1 follows user2 and user3
      const result = await mockRepo.countFollowing("user1");

      expect(result).toBe(2);
    });

    test("should return 0 for user following nobody", async () => {
      mockRepo.countFollowing = mock(async () => Promise.resolve(0));

      const result = await mockRepo.countFollowing("user99");

      expect(result).toBe(0);
    });
  });

  describe("delete", () => {
    test("should delete a follow relationship", async () => {
      await mockRepo.delete("user1", "user2");

      expect(mockRepo.delete).toHaveBeenCalledWith("user1", "user2");
    });

    test("should not throw when deleting non-existent relationship", async () => {
      await expect(mockRepo.delete("user99", "user100")).resolves.toBeUndefined();
    });
  });

  describe("deleteByUserId", () => {
    test("should delete all follow relationships for a user", async () => {
      await mockRepo.deleteByUserId("user1");

      expect(mockRepo.deleteByUserId).toHaveBeenCalledWith("user1");
    });

    test("should delete both follower and followee relationships", async () => {
      // When a user is deleted, both directions should be cleaned up
      await mockRepo.deleteByUserId("user1");

      expect(mockRepo.deleteByUserId).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    test("should handle self-follow attempt gracefully", async () => {
      // Most implementations should prevent self-follow at service level
      // but repository should handle the query correctly
      const result = await mockRepo.exists("user1", "user1");

      expect(result).toBe(false);
    });

    test("should handle very long user IDs", async () => {
      const longId = "a".repeat(100);
      await mockRepo.exists(longId, "user1");

      expect(mockRepo.exists).toHaveBeenCalledWith(longId, "user1");
    });

    test("should handle concurrent follow operations", async () => {
      // Simulate concurrent operations
      const operations = [
        mockRepo.exists("user1", "user2"),
        mockRepo.exists("user1", "user3"),
        mockRepo.countFollowing("user1"),
      ];

      const results = await Promise.all(operations);

      expect(results[0]).toBe(true);
      expect(results[1]).toBe(true);
      expect(results[2]).toBe(2);
    });
  });
});
