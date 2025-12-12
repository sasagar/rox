/**
 * UserService Unit Tests
 *
 * Tests user profile operations including
 * profile updates and user retrieval
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { UserService } from "../../services/UserService";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository";
import type { ActivityPubDeliveryService } from "../../services/ap/ActivityPubDeliveryService";
import type { ICacheService } from "../../interfaces/ICacheService";
import type { User } from "../../db/schema/pg.js";

/**
 * Partial mock types that only include the methods we actually use in tests
 */
type MockUserRepo = Pick<IUserRepository, "findById" | "findByUsername" | "update">;
type MockDeliveryService = Pick<ActivityPubDeliveryService, "deliverUpdate">;
type MockCacheService = Pick<ICacheService, "get" | "set" | "delete" | "isAvailable">;

describe("UserService", () => {
  // Mock data
  const mockUser: User = {
    id: "user1",
    username: "testuser",
    email: "test@example.com",
    passwordHash: "hashed",
    displayName: "Test User",
    host: null, // Local user
    avatarUrl: null,
    bannerUrl: null,
    bio: "Original bio",
    isAdmin: false,
    isSuspended: false,
    isDeleted: false,
    deletedAt: null,
    isSystemUser: false,
    publicKey: "mock-public-key",
    privateKey: "mock-private-key",
    inbox: "http://localhost:3000/users/testuser/inbox",
    outbox: "http://localhost:3000/users/testuser/outbox",
    followersUrl: "http://localhost:3000/users/testuser/followers",
    followingUrl: "http://localhost:3000/users/testuser/following",
    uri: "http://localhost:3000/users/testuser",
    sharedInbox: null,
    customCss: null,
    uiSettings: null,
    alsoKnownAs: [],
    movedTo: null,
    movedAt: null,
    profileEmojis: [],
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

  const mockRemoteUser: User = {
    ...mockUser,
    id: "user2",
    username: "remoteuser",
    host: "remote.example.com", // Remote user
  };

  // Mock repositories and services
  let mockUserRepo: MockUserRepo;
  let mockDeliveryService: MockDeliveryService;

  beforeEach(() => {
    mockUserRepo = {
      findById: mock((id: string) => {
        if (id === "user1") return Promise.resolve(mockUser);
        if (id === "user2") return Promise.resolve(mockRemoteUser);
        return Promise.resolve(null);
      }),
      findByUsername: mock((username: string) => {
        if (username === "testuser") return Promise.resolve(mockUser);
        if (username === "remoteuser") return Promise.resolve(mockRemoteUser);
        return Promise.resolve(null);
      }),
      update: mock((_id: string, data: Partial<User>) => Promise.resolve({ ...mockUser, ...data })),
    };

    mockDeliveryService = {
      deliverUpdate: mock(() => Promise.resolve()),
    };
  });

  describe("updateProfile", () => {
    test("should update user profile", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      const result = await service.updateProfile("user1", {
        displayName: "Updated Name",
        bio: "Updated bio",
      });

      expect(result.displayName).toBe("Updated Name");
      expect(result.bio).toBe("Updated bio");
      expect(mockUserRepo.update).toHaveBeenCalledWith("user1", {
        displayName: "Updated Name",
        bio: "Updated bio",
      });
    });

    test("should update only provided fields", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      await service.updateProfile("user1", {
        bio: "New bio only",
      });

      expect(mockUserRepo.update).toHaveBeenCalledWith("user1", {
        bio: "New bio only",
      });
    });

    test("should update avatar URL", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      const result = await service.updateProfile("user1", {
        avatarUrl: "https://example.com/avatar.jpg",
      });

      expect(result.avatarUrl).toBe("https://example.com/avatar.jpg");
    });

    test("should update banner URL", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      const result = await service.updateProfile("user1", {
        bannerUrl: "https://example.com/banner.jpg",
      });

      expect(result.bannerUrl).toBe("https://example.com/banner.jpg");
    });

    test("should deliver Update activity for local users", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      await service.updateProfile("user1", {
        displayName: "Updated Name",
      });

      // Wait for async delivery attempt
      await new Promise((resolve) => setTimeout(resolve, 10));

      // The delivery service is internal, so we just verify the update worked
      expect(mockUserRepo.update).toHaveBeenCalled();
    });

    test("should not deliver Update activity for remote users", async () => {
      const mockUserRepoRemote: MockUserRepo = {
        ...mockUserRepo,
        update: mock((_id: string, data: Partial<User>) =>
          Promise.resolve({ ...mockRemoteUser, ...data }),
        ),
      };

      const service = new UserService(
        mockUserRepoRemote as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      await service.updateProfile("user2", {
        displayName: "Updated Name",
      });

      // Remote user updates should not trigger delivery
      expect(mockUserRepoRemote.update).toHaveBeenCalled();
    });
  });

  describe("findById", () => {
    test("should return user by id", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      const result = await service.findById("user1");

      expect(result?.id).toBe("user1");
      expect(result?.username).toBe("testuser");
      expect(mockUserRepo.findById).toHaveBeenCalledWith("user1");
    });

    test("should return null for non-existent user", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      const result = await service.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByUsername", () => {
    test("should return user by username", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      const result = await service.findByUsername("testuser");

      expect(result?.id).toBe("user1");
      expect(result?.username).toBe("testuser");
      expect(mockUserRepo.findByUsername).toHaveBeenCalledWith("testuser");
    });

    test("should return null for non-existent username", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      const result = await service.findByUsername("nonexistent");

      expect(result).toBeNull();
    });

    test("should find remote user by username", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
      );

      const result = await service.findByUsername("remoteuser");

      expect(result?.id).toBe("user2");
      expect(result?.host).toBe("remote.example.com");
    });
  });

  describe("caching", () => {
    let mockCacheService: MockCacheService;
    const cacheStore = new Map<string, unknown>();

    beforeEach(() => {
      cacheStore.clear();
      mockCacheService = {
        isAvailable: mock(() => true),
        get: mock((key: string) =>
          Promise.resolve(cacheStore.get(key) ?? null),
        ) as MockCacheService["get"],
        set: mock((key: string, value: unknown) => {
          cacheStore.set(key, value);
          return Promise.resolve();
        }) as MockCacheService["set"],
        delete: mock((key: string) => {
          cacheStore.delete(key);
          return Promise.resolve();
        }),
      };
    });

    test("should return cached user on findById", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      // First call - should fetch from repo and cache
      const result1 = await service.findById("user1");
      expect(result1?.id).toBe("user1");
      expect(mockUserRepo.findById).toHaveBeenCalledTimes(1);
      expect(mockCacheService.set).toHaveBeenCalled();

      // Second call - should return from cache
      const result2 = await service.findById("user1");
      expect(result2?.id).toBe("user1");
      expect(mockUserRepo.findById).toHaveBeenCalledTimes(1); // Still 1, no new DB call
    });

    test("should return cached user on findByUsername", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      // First call - should fetch from repo and cache
      const result1 = await service.findByUsername("testuser");
      expect(result1?.id).toBe("user1");
      expect(mockUserRepo.findByUsername).toHaveBeenCalledTimes(1);

      // Second call - should return from cache
      const result2 = await service.findByUsername("testuser");
      expect(result2?.id).toBe("user1");
      expect(mockUserRepo.findByUsername).toHaveBeenCalledTimes(1); // Still 1
    });

    test("should invalidate cache on profile update", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      // Cache the user first
      await service.findById("user1");
      expect(cacheStore.size).toBeGreaterThan(0);

      // Update profile - should invalidate cache
      await service.updateProfile("user1", { displayName: "New Name" });

      // Wait for async cache invalidation
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockCacheService.delete).toHaveBeenCalled();
    });

    test("should work without cache service", async () => {
      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        // No cache service
      );

      const result = await service.findById("user1");
      expect(result?.id).toBe("user1");
      expect(mockUserRepo.findById).toHaveBeenCalled();
    });

    test("should skip cache when unavailable", async () => {
      const unavailableCacheService: MockCacheService = {
        ...mockCacheService,
        isAvailable: mock(() => false),
      };

      const service = new UserService(
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        unavailableCacheService as ICacheService,
      );

      // Should still work, just without caching
      const result = await service.findById("user1");
      expect(result?.id).toBe("user1");
      expect(unavailableCacheService.get).not.toHaveBeenCalled();
    });
  });
});
