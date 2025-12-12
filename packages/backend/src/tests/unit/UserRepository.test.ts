/**
 * User Repository Unit Tests
 *
 * Tests the user repository interface contract using mock implementations.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import type {
  IUserRepository,
  ListUsersOptions,
  SearchUsersOptions,
} from "../../interfaces/repositories/IUserRepository.js";
import type { User } from "../../../../shared/src/types/user.js";

describe("UserRepository", () => {
  // Mock user data (matches actual User type from shared/types/user.ts)
  const mockLocalUser: User = {
    id: "user1",
    username: "testuser",
    email: "test@example.com",
    passwordHash: "hashed_password",
    displayName: "Test User",
    bio: "Hello, I am a test user",
    host: null,
    uri: null,
    avatarUrl: null,
    bannerUrl: null,
    isAdmin: false,
    isDeleted: false,
    deletedAt: null,
    isSystemUser: false,
    isSuspended: false,
    publicKey: null,
    privateKey: null,
    inbox: null,
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

  const mockRemoteUser: User = {
    ...mockLocalUser,
    id: "user2",
    username: "remoteuser",
    email: "remote@example.com",
    displayName: "Remote User",
    host: "remote.example",
    uri: "https://remote.example/users/remoteuser",
    inbox: "https://remote.example/users/remoteuser/inbox",
    outbox: "https://remote.example/users/remoteuser/outbox",
    followersUrl: "https://remote.example/users/remoteuser/followers",
    followingUrl: "https://remote.example/users/remoteuser/following",
    publicKey: "-----BEGIN PUBLIC KEY-----...",
  };

  const mockAdminUser: User = {
    ...mockLocalUser,
    id: "admin1",
    username: "admin",
    email: "admin@example.com",
    displayName: "Administrator",
    isAdmin: true,
  };

  let mockRepo: IUserRepository;

  beforeEach(() => {
    mockRepo = {
      create: mock(async (user) =>
        Promise.resolve({
          ...user,
          id: user.id || "new-user-id",
          createdAt: new Date(),
          updatedAt: new Date(),
        } as User)
      ),
      findById: mock(async (id: string) => {
        const users = [mockLocalUser, mockRemoteUser, mockAdminUser];
        return Promise.resolve(users.find((u) => u.id === id) || null);
      }),
      findAll: mock(async () => Promise.resolve([mockLocalUser, mockRemoteUser])),
      findByUsername: mock(async (username: string, host?: string | null) => {
        if (host) {
          return username === "remoteuser" && host === "remote.example"
            ? Promise.resolve(mockRemoteUser)
            : Promise.resolve(null);
        }
        return username === "testuser"
          ? Promise.resolve(mockLocalUser)
          : Promise.resolve(null);
      }),
      findByEmail: mock(async (email: string) =>
        email === "test@example.com"
          ? Promise.resolve(mockLocalUser)
          : Promise.resolve(null)
      ),
      findByUri: mock(async (uri: string) =>
        uri === mockRemoteUser.uri
          ? Promise.resolve(mockRemoteUser)
          : Promise.resolve(null)
      ),
      update: mock(async (id: string, data: Partial<User>) =>
        Promise.resolve({ ...mockLocalUser, ...data, id, updatedAt: new Date() })
      ),
      delete: mock(async () => Promise.resolve()),
      count: mock(async (localOnly?: boolean) =>
        localOnly ? Promise.resolve(3) : Promise.resolve(5)
      ),
      countRemote: mock(async () => Promise.resolve(2)),
      countActiveLocal: mock(async () => Promise.resolve(2)),
      search: mock(async () => Promise.resolve([mockLocalUser])),
      findWithFetchErrors: mock(async () => Promise.resolve([])),
      countWithFetchErrors: mock(async () => Promise.resolve(0)),
      recordFetchFailure: mock(async () => Promise.resolve()),
      clearFetchFailure: mock(async () => Promise.resolve()),
      findFirstLocalAdmin: mock(async () => Promise.resolve(mockAdminUser)),
      findSystemUser: mock(async () => Promise.resolve(null)),
      countRegistrationsInPeriod: mock(async () => Promise.resolve(0)),
      incrementFollowersCount: mock(async () => Promise.resolve()),
      decrementFollowersCount: mock(async () => Promise.resolve()),
      incrementFollowingCount: mock(async () => Promise.resolve()),
      decrementFollowingCount: mock(async () => Promise.resolve()),
    };
  });

  describe("create", () => {
    test("should create a local user", async () => {
      const input: Omit<User, "createdAt" | "updatedAt"> = {
        id: "new-user-id",
        username: "newuser",
        email: "new@example.com",
        passwordHash: "hashed_password",
        displayName: "New User",
        host: null,
        uri: null,
        avatarUrl: null,
        bannerUrl: null,
        bio: null,
        isAdmin: false,
        isDeleted: false,
        deletedAt: null,
    isSystemUser: false,
        isSuspended: false,
        publicKey: null,
        privateKey: null,
        inbox: null,
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
      };

      const result = await mockRepo.create(input);

      expect(result.id).toBe("new-user-id");
      expect(result.username).toBe("newuser");
      expect(result.host).toBeNull();
      expect(result.createdAt).toBeDefined();
      expect(mockRepo.create).toHaveBeenCalled();
    });

    test("should create a remote user with ActivityPub fields", async () => {
      const input: Omit<User, "createdAt" | "updatedAt"> = {
        id: "remote-new-id",
        username: "remoteactor",
        email: "remote@server.com",
        passwordHash: "",
        displayName: "Remote Actor",
        host: "remote.server",
        uri: "https://remote.server/users/remoteactor",
        avatarUrl: "https://remote.server/avatar.png",
        bannerUrl: null,
        bio: "Remote bio",
        isAdmin: false,
        isDeleted: false,
        deletedAt: null,
    isSystemUser: false,
        isSuspended: false,
        publicKey: "-----BEGIN PUBLIC KEY-----...",
        privateKey: null,
        inbox: "https://remote.server/users/remoteactor/inbox",
        outbox: "https://remote.server/users/remoteactor/outbox",
        followersUrl: "https://remote.server/users/remoteactor/followers",
        followingUrl: "https://remote.server/users/remoteactor/following",
        sharedInbox: "https://remote.server/inbox",
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
      };

      const result = await mockRepo.create(input);

      expect(result.host).toBe("remote.server");
      expect(result.uri).toBe("https://remote.server/users/remoteactor");
      expect(result.inbox).toBeDefined();
    });

    test("should create an admin user", async () => {
      const input: Omit<User, "createdAt" | "updatedAt"> = {
        ...mockLocalUser,
        id: "new-admin-id",
        username: "newadmin",
        email: "newadmin@example.com",
        isAdmin: true,
      };

      const result = await mockRepo.create(input);

      expect(result.isAdmin).toBe(true);
    });
  });

  describe("findById", () => {
    test("should find an existing user by ID", async () => {
      const result = await mockRepo.findById("user1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("user1");
      expect(result!.username).toBe("testuser");
    });

    test("should return null for non-existent user", async () => {
      const result = await mockRepo.findById("nonexistent");

      expect(result).toBeNull();
    });

    test("should find admin user", async () => {
      const result = await mockRepo.findById("admin1");

      expect(result).not.toBeNull();
      expect(result!.isAdmin).toBe(true);
    });
  });

  describe("findAll", () => {
    test("should return all users with default options", async () => {
      const result = await mockRepo.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    test("should support pagination", async () => {
      const options: ListUsersOptions = {
        limit: 10,
        offset: 0,
      };

      await mockRepo.findAll(options);

      expect(mockRepo.findAll).toHaveBeenCalledWith(options);
    });

    test("should filter by local users only", async () => {
      mockRepo.findAll = mock(async (options) => {
        if (options?.localOnly) {
          return Promise.resolve([mockLocalUser, mockAdminUser]);
        }
        return Promise.resolve([mockLocalUser, mockRemoteUser, mockAdminUser]);
      });

      const result = await mockRepo.findAll({ localOnly: true });

      expect(result.every((u) => u.host === null)).toBe(true);
    });

    test("should filter by admin status", async () => {
      mockRepo.findAll = mock(async (options) => {
        if (options?.isAdmin) {
          return Promise.resolve([mockAdminUser]);
        }
        return Promise.resolve([mockLocalUser]);
      });

      const result = await mockRepo.findAll({ isAdmin: true });

      expect(result.every((u) => u.isAdmin)).toBe(true);
    });
  });

  describe("findByUsername", () => {
    test("should find local user by username", async () => {
      const result = await mockRepo.findByUsername("testuser");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("testuser");
      expect(result!.host).toBeNull();
    });

    test("should find remote user by username and host", async () => {
      const result = await mockRepo.findByUsername("remoteuser", "remote.example");

      expect(result).not.toBeNull();
      expect(result!.username).toBe("remoteuser");
      expect(result!.host).toBe("remote.example");
    });

    test("should return null for non-existent username", async () => {
      const result = await mockRepo.findByUsername("unknownuser");

      expect(result).toBeNull();
    });

    test("should return null for wrong host", async () => {
      const result = await mockRepo.findByUsername("remoteuser", "wrong.host");

      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    test("should find user by email", async () => {
      const result = await mockRepo.findByEmail("test@example.com");

      expect(result).not.toBeNull();
      expect(result!.email).toBe("test@example.com");
    });

    test("should return null for non-existent email", async () => {
      const result = await mockRepo.findByEmail("unknown@example.com");

      expect(result).toBeNull();
    });
  });

  describe("findByUri", () => {
    test("should find remote user by ActivityPub URI", async () => {
      const result = await mockRepo.findByUri("https://remote.example/users/remoteuser");

      expect(result).not.toBeNull();
      expect(result!.uri).toBe("https://remote.example/users/remoteuser");
      expect(result!.host).toBe("remote.example");
    });

    test("should return null for non-existent URI", async () => {
      const result = await mockRepo.findByUri("https://unknown.example/users/nobody");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    test("should update user display name", async () => {
      const result = await mockRepo.update("user1", { displayName: "Updated Name" });

      expect(result.displayName).toBe("Updated Name");
      expect(mockRepo.update).toHaveBeenCalledWith("user1", { displayName: "Updated Name" });
    });

    test("should update user bio", async () => {
      const result = await mockRepo.update("user1", { bio: "New bio content" });

      expect(result.bio).toBe("New bio content");
    });

    test("should update user avatar", async () => {
      const result = await mockRepo.update("user1", { avatarUrl: "https://example.com/avatar.png" });

      expect(result.avatarUrl).toBe("https://example.com/avatar.png");
    });

    test("should suspend user", async () => {
      const result = await mockRepo.update("user1", { isSuspended: true });

      expect(result.isSuspended).toBe(true);
    });
  });

  describe("delete", () => {
    test("should delete a user", async () => {
      await mockRepo.delete("user1");

      expect(mockRepo.delete).toHaveBeenCalledWith("user1");
    });
  });

  describe("Count Methods", () => {
    describe("count", () => {
      test("should return total user count", async () => {
        const result = await mockRepo.count();

        expect(result).toBe(5);
      });

      test("should return local user count only", async () => {
        const result = await mockRepo.count(true);

        expect(result).toBe(3);
      });
    });

    describe("countRemote", () => {
      test("should return remote user count", async () => {
        const result = await mockRepo.countRemote();

        expect(result).toBe(2);
      });
    });

    describe("countActiveLocal", () => {
      test("should return active local user count", async () => {
        const result = await mockRepo.countActiveLocal(30);

        expect(result).toBe(2);
        expect(mockRepo.countActiveLocal).toHaveBeenCalledWith(30);
      });

      test("should support different time periods", async () => {
        await mockRepo.countActiveLocal(7);
        await mockRepo.countActiveLocal(180);

        expect(mockRepo.countActiveLocal).toHaveBeenCalledWith(7);
        expect(mockRepo.countActiveLocal).toHaveBeenCalledWith(180);
      });
    });
  });

  describe("search", () => {
    test("should search users by query", async () => {
      const options: SearchUsersOptions = {
        query: "test",
        limit: 20,
      };

      const result = await mockRepo.search(options);

      expect(Array.isArray(result)).toBe(true);
      expect(mockRepo.search).toHaveBeenCalledWith(options);
    });

    test("should search with local only filter", async () => {
      const options: SearchUsersOptions = {
        query: "user",
        limit: 20,
        localOnly: true,
      };

      await mockRepo.search(options);

      expect(mockRepo.search).toHaveBeenCalledWith(options);
    });

    test("should search with offset for pagination", async () => {
      const options: SearchUsersOptions = {
        query: "user",
        limit: 20,
        offset: 20,
      };

      await mockRepo.search(options);

      expect(mockRepo.search).toHaveBeenCalledWith(options);
    });

    test("should return empty array for no matches", async () => {
      mockRepo.search = mock(async () => Promise.resolve([]));

      const result = await mockRepo.search({ query: "xxxxxxxx", limit: 20 });

      expect(result).toEqual([]);
    });
  });

  describe("Fetch Error Tracking (Gone Users)", () => {
    const mockGoneUser: User = {
      ...mockRemoteUser,
      id: "gone-user",
      username: "goneuser",
      host: "gone.example",
      goneDetectedAt: new Date("2024-01-01"),
      fetchFailureCount: 5,
      lastFetchAttemptAt: new Date("2024-01-15"),
      lastFetchError: "410 Gone",
    };

    describe("findWithFetchErrors", () => {
      test("should return users with fetch errors", async () => {
        mockRepo.findWithFetchErrors = mock(async () => Promise.resolve([mockGoneUser]));

        const result = await mockRepo.findWithFetchErrors();

        expect(Array.isArray(result)).toBe(true);
        expect(result.length).toBe(1);
        expect(result[0]!.goneDetectedAt).not.toBeNull();
        expect(result[0]!.fetchFailureCount).toBeGreaterThan(0);
      });

      test("should return empty array when no users have fetch errors", async () => {
        const result = await mockRepo.findWithFetchErrors();

        expect(result).toEqual([]);
      });

      test("should support pagination options", async () => {
        mockRepo.findWithFetchErrors = mock(async (options?: { limit?: number; offset?: number }) => {
          expect(options?.limit).toBe(50);
          return Promise.resolve([mockGoneUser]);
        });

        await mockRepo.findWithFetchErrors({ limit: 50 });

        expect(mockRepo.findWithFetchErrors).toHaveBeenCalledWith({ limit: 50 });
      });
    });

    describe("countWithFetchErrors", () => {
      test("should return count of users with fetch errors", async () => {
        mockRepo.countWithFetchErrors = mock(async () => Promise.resolve(3));

        const result = await mockRepo.countWithFetchErrors();

        expect(result).toBe(3);
      });

      test("should return zero when no users have fetch errors", async () => {
        const result = await mockRepo.countWithFetchErrors();

        expect(result).toBe(0);
      });
    });

    describe("recordFetchFailure", () => {
      test("should record a fetch failure for a user", async () => {
        const errorMessage = "410 Gone";

        await mockRepo.recordFetchFailure("user2", errorMessage);

        expect(mockRepo.recordFetchFailure).toHaveBeenCalledWith("user2", errorMessage);
      });

      test("should handle different error types", async () => {
        await mockRepo.recordFetchFailure("user2", "Connection timeout");
        await mockRepo.recordFetchFailure("user2", "DNS resolution failed");

        expect(mockRepo.recordFetchFailure).toHaveBeenCalledTimes(2);
      });
    });

    describe("clearFetchFailure", () => {
      test("should clear fetch failure status for a user", async () => {
        await mockRepo.clearFetchFailure("gone-user");

        expect(mockRepo.clearFetchFailure).toHaveBeenCalledWith("gone-user");
      });

      test("should not throw when clearing non-existent failure", async () => {
        // clearFetchFailure should complete without errors even for non-existent users
        await mockRepo.clearFetchFailure("user1");
        expect(mockRepo.clearFetchFailure).toHaveBeenCalledWith("user1");
      });
    });
  });
});
