/**
 * UserDeletionService Unit Tests
 *
 * Tests user account deletion including:
 * - Local user soft delete
 * - Remote user deletion handling
 * - Session invalidation
 * - Follow relationship cleanup
 * - ActivityPub Delete activity delivery
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { UserDeletionService } from "../../services/UserDeletionService.js";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { IFollowRepository } from "../../interfaces/repositories/IFollowRepository.js";
import type { ISessionRepository } from "../../interfaces/repositories/ISessionRepository.js";
import type { INoteRepository } from "../../interfaces/repositories/INoteRepository.js";
import type { ActivityPubDeliveryService } from "../../services/ap/ActivityPubDeliveryService.js";
import type { User } from "../../db/schema/pg.js";

describe("UserDeletionService", () => {
  // Mock user data
  const mockLocalUser: User = {
    id: "local-user-1",
    username: "localuser",
    email: "local@example.com",
    passwordHash: "hashed-password",
    displayName: "Local User",
    host: null, // Local user
    avatarUrl: "https://example.com/avatar.png",
    bannerUrl: null,
    bio: "Test bio",
    isAdmin: false,
    isSuspended: false,
    isDeleted: false,
    deletedAt: null,
    publicKey: "mock-public-key",
    privateKey: "mock-private-key",
    inbox: "http://localhost:3000/users/localuser/inbox",
    outbox: "http://localhost:3000/users/localuser/outbox",
    followersUrl: "http://localhost:3000/users/localuser/followers",
    followingUrl: "http://localhost:3000/users/localuser/following",
    uri: "http://localhost:3000/users/localuser",
    sharedInbox: null,
    customCss: null,
    uiSettings: null,
    alsoKnownAs: [],
    movedTo: null,
    movedAt: null,
    profileEmojis: [],
    storageQuotaMb: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRemoteUser = {
    ...mockLocalUser,
    id: "remote-user-1",
    username: "remoteuser",
    email: null as unknown as string, // Remote users may not have email
    host: "remote.example.com",
    privateKey: null,
  } as User;

  const mockAdminUser: User = {
    ...mockLocalUser,
    id: "admin-user-1",
    username: "admin",
    isAdmin: true,
  };

  const mockDeletedUser: User = {
    ...mockLocalUser,
    id: "deleted-user-1",
    username: "deleteduser",
    isDeleted: true,
    deletedAt: new Date(),
  };

  // Mock repositories
  let mockUserRepo: Partial<IUserRepository>;
  let mockFollowRepo: Partial<IFollowRepository>;
  let mockSessionRepo: Partial<ISessionRepository>;
  let mockNoteRepo: Partial<INoteRepository>;
  let mockDeliveryService: Partial<ActivityPubDeliveryService>;

  let service: UserDeletionService;

  beforeEach(() => {
    mockUserRepo = {
      findById: mock((id: string) => {
        if (id === "local-user-1") return Promise.resolve(mockLocalUser);
        if (id === "remote-user-1") return Promise.resolve(mockRemoteUser);
        if (id === "admin-user-1") return Promise.resolve(mockAdminUser);
        if (id === "deleted-user-1") return Promise.resolve(mockDeletedUser);
        return Promise.resolve(null);
      }),
      update: mock(() => Promise.resolve(mockLocalUser)),
    };

    mockFollowRepo = {
      deleteByUserId: mock(() => Promise.resolve()),
    };

    mockSessionRepo = {
      deleteByUserId: mock(() => Promise.resolve()),
    };

    mockNoteRepo = {
      findByUserId: mock(() => Promise.resolve([])),
      delete: mock(() => Promise.resolve()),
    };

    mockDeliveryService = {
      deliverDeleteActor: mock(() => Promise.resolve(5)),
    };

    service = new UserDeletionService(
      mockUserRepo as IUserRepository,
      mockFollowRepo as IFollowRepository,
      mockSessionRepo as ISessionRepository,
      mockNoteRepo as INoteRepository,
      mockDeliveryService as ActivityPubDeliveryService
    );
  });

  describe("deleteLocalUser", () => {
    test("should successfully delete a local user", async () => {
      const result = await service.deleteLocalUser("local-user-1");

      expect(result.success).toBe(true);
      expect(result.message).toBe("User deleted successfully");
      expect(result.deletedUserId).toBe("local-user-1");
      expect(result.isRemoteUser).toBe(false);

      // Verify user was updated with deleted status
      expect(mockUserRepo.update).toHaveBeenCalled();

      // Verify sessions were invalidated
      expect(mockSessionRepo.deleteByUserId).toHaveBeenCalledWith("local-user-1");

      // Verify follows were removed
      expect(mockFollowRepo.deleteByUserId).toHaveBeenCalledWith("local-user-1");

      // Verify Delete activity was sent
      expect(mockDeliveryService.deliverDeleteActor).toHaveBeenCalled();
    });

    test("should return error for non-existent user", async () => {
      const result = await service.deleteLocalUser("non-existent");

      expect(result.success).toBe(false);
      expect(result.message).toBe("User not found");
    });

    test("should return error when trying to delete remote user", async () => {
      const result = await service.deleteLocalUser("remote-user-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Cannot delete remote users. Use deleteRemoteUser instead.");
      expect(result.isRemoteUser).toBe(true);
    });

    test("should return error when trying to delete admin user", async () => {
      const result = await service.deleteLocalUser("admin-user-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("Cannot delete admin users. Remove admin status first.");
    });

    test("should return error when user is already deleted", async () => {
      const result = await service.deleteLocalUser("deleted-user-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("User is already deleted");
    });

    test("should delete notes when deleteNotes option is true", async () => {
      const mockNotes = [{ id: "note1" }, { id: "note2" }];
      mockNoteRepo.findByUserId = mock()
        .mockResolvedValueOnce(mockNotes)
        .mockResolvedValueOnce([]);

      const result = await service.deleteLocalUser("local-user-1", { deleteNotes: true });

      expect(result.success).toBe(true);
      expect(mockNoteRepo.findByUserId).toHaveBeenCalled();
      expect(mockNoteRepo.delete).toHaveBeenCalledTimes(2);
    });

    test("should return activitiesSent count", async () => {
      const result = await service.deleteLocalUser("local-user-1");

      expect(result.activitiesSent).toBe(5);
    });
  });

  describe("deleteRemoteUser", () => {
    test("should successfully mark remote user as deleted", async () => {
      const result = await service.deleteRemoteUser("remote-user-1");

      expect(result.success).toBe(true);
      expect(result.message).toBe("Remote user marked as deleted");
      expect(result.isRemoteUser).toBe(true);

      // Verify user was updated
      expect(mockUserRepo.update).toHaveBeenCalled();

      // Verify follows were removed
      expect(mockFollowRepo.deleteByUserId).toHaveBeenCalledWith("remote-user-1");
    });

    test("should return error for non-existent user", async () => {
      const result = await service.deleteRemoteUser("non-existent");

      expect(result.success).toBe(false);
      expect(result.message).toBe("User not found");
    });

    test("should return error when trying to delete local user", async () => {
      const result = await service.deleteRemoteUser("local-user-1");

      expect(result.success).toBe(false);
      expect(result.message).toBe("This is a local user. Use deleteLocalUser instead.");
      expect(result.isRemoteUser).toBe(false);
    });

    test("should return success when user is already deleted", async () => {
      mockUserRepo.findById = mock(() =>
        Promise.resolve({ ...mockRemoteUser, isDeleted: true })
      );

      const result = await service.deleteRemoteUser("remote-user-1");

      expect(result.success).toBe(true);
      expect(result.message).toBe("User was already deleted");
    });
  });

  describe("isUserDeleted", () => {
    test("should return true for deleted user", async () => {
      const isDeleted = await service.isUserDeleted("deleted-user-1");
      expect(isDeleted).toBe(true);
    });

    test("should return false for non-deleted user", async () => {
      const isDeleted = await service.isUserDeleted("local-user-1");
      expect(isDeleted).toBe(false);
    });

    test("should return false for non-existent user", async () => {
      const isDeleted = await service.isUserDeleted("non-existent");
      expect(isDeleted).toBe(false);
    });
  });
});
