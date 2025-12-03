/**
 * PasskeyService Unit Tests
 *
 * Tests for passkey (WebAuthn) management including:
 * - Getting user passkeys
 * - Deleting passkeys (with security checks)
 * - Renaming passkeys
 * - Error handling for missing users/passkeys
 *
 * Note: WebAuthn verification tests are omitted as they require
 * cryptographic operations that are difficult to mock properly.
 *
 * @module tests/unit/PasskeyService
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { PasskeyService } from "../../services/PasskeyService";
import type { IPasskeyCredentialRepository } from "../../interfaces/repositories/IPasskeyCredentialRepository";
import type { IPasskeyChallengeRepository } from "../../interfaces/repositories/IPasskeyChallengeRepository";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository";
import type { ISessionRepository } from "../../interfaces/repositories/ISessionRepository";
import type { User } from "../../db/schema/pg.js";
import type { PasskeyCredential } from "../../db/schema/pg.js";

/**
 * Partial mock types that only include the methods we actually use in tests
 */
type MockPasskeyCredentialRepo = Pick<
  IPasskeyCredentialRepository,
  "findByUserId" | "findById" | "findByCredentialId" | "create" | "delete" | "updateName" | "countByUserId" | "updateCounter"
>;

type MockPasskeyChallengeRepo = Pick<
  IPasskeyChallengeRepository,
  "create" | "findByChallenge" | "deleteByChallenge"
>;

type MockUserRepo = Pick<
  IUserRepository,
  "findById" | "findByUsername"
>;

type MockSessionRepo = Pick<
  ISessionRepository,
  "create"
>;

describe("PasskeyService", () => {
  // Mock data
  const mockUser: User = {
    id: "user1",
    username: "testuser",
    email: "test@example.com",
    passwordHash: "$argon2id$v=19$m=65536,t=3,p=4$mock",
    displayName: "Test User",
    host: null,
    avatarUrl: null,
    bannerUrl: null,
    bio: null,
    isAdmin: false,
    isSuspended: false,
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPasskey: PasskeyCredential = {
    id: "passkey1",
    userId: "user1",
    credentialId: "credential-id-123",
    publicKey: "mock-public-key-base64",
    counter: 0,
    deviceType: "singleDevice",
    backedUp: false,
    transports: ["internal"],
    name: "My Passkey",
    createdAt: new Date(),
    lastUsedAt: null,
  };

  // Mock repositories
  let mockPasskeyCredentialRepo: MockPasskeyCredentialRepo;
  let mockPasskeyChallengeRepo: MockPasskeyChallengeRepo;
  let mockUserRepo: MockUserRepo;
  let mockSessionRepo: MockSessionRepo;

  beforeEach(() => {
    mockPasskeyCredentialRepo = {
      findByUserId: mock(() => Promise.resolve([mockPasskey])),
      findById: mock(() => Promise.resolve(mockPasskey)),
      findByCredentialId: mock(() => Promise.resolve(mockPasskey)),
      create: mock(() => Promise.resolve(mockPasskey)),
      delete: mock(() => Promise.resolve()),
      updateName: mock(() => Promise.resolve({ ...mockPasskey, name: "New Name" })),
      countByUserId: mock(() => Promise.resolve(2)), // Multiple passkeys by default
      updateCounter: mock(() => Promise.resolve(mockPasskey)),
    };

    mockPasskeyChallengeRepo = {
      create: mock(() => Promise.resolve({ id: "challenge1", challenge: "test-challenge", userId: "user1", type: "registration", expiresAt: new Date(), createdAt: new Date() })),
      findByChallenge: mock(() => Promise.resolve({ id: "challenge1", challenge: "test-challenge", userId: "user1", type: "registration", expiresAt: new Date(), createdAt: new Date() })),
      deleteByChallenge: mock(() => Promise.resolve()),
    };

    mockUserRepo = {
      findById: mock(() => Promise.resolve(mockUser)),
      findByUsername: mock(() => Promise.resolve(mockUser)),
    };

    mockSessionRepo = {
      create: mock(() => Promise.resolve({
        id: "session1",
        userId: "user1",
        token: "mock-token",
        expiresAt: new Date(),
        userAgent: null,
        ipAddress: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
    };
  });

  describe("getUserPasskeys", () => {
    test("should return all passkeys for a user", async () => {
      const service = new PasskeyService(
        mockPasskeyCredentialRepo as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      const passkeys = await service.getUserPasskeys("user1");

      expect(passkeys).toHaveLength(1);
      expect(passkeys[0]?.id).toBe("passkey1");
      expect(mockPasskeyCredentialRepo.findByUserId).toHaveBeenCalledWith("user1");
    });

    test("should return empty array for user with no passkeys", async () => {
      const mockRepoEmpty: MockPasskeyCredentialRepo = {
        ...mockPasskeyCredentialRepo,
        findByUserId: mock(() => Promise.resolve([])),
      };

      const service = new PasskeyService(
        mockRepoEmpty as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      const passkeys = await service.getUserPasskeys("user1");

      expect(passkeys).toHaveLength(0);
    });
  });

  describe("deletePasskey", () => {
    test("should delete a passkey when user has multiple passkeys", async () => {
      const service = new PasskeyService(
        mockPasskeyCredentialRepo as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      await service.deletePasskey("user1", "passkey1");

      expect(mockPasskeyCredentialRepo.delete).toHaveBeenCalledWith("passkey1");
    });

    test("should throw error when passkey not found", async () => {
      const mockRepoEmpty: MockPasskeyCredentialRepo = {
        ...mockPasskeyCredentialRepo,
        findById: mock(() => Promise.resolve(null)),
      };

      const service = new PasskeyService(
        mockRepoEmpty as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      await expect(
        service.deletePasskey("user1", "nonexistent")
      ).rejects.toThrow("Passkey not found");
    });

    test("should throw error when passkey belongs to different user", async () => {
      const wrongUserPasskey = { ...mockPasskey, userId: "user2" };
      const mockRepoWrongUser: MockPasskeyCredentialRepo = {
        ...mockPasskeyCredentialRepo,
        findById: mock(() => Promise.resolve(wrongUserPasskey)),
      };

      const service = new PasskeyService(
        mockRepoWrongUser as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      await expect(
        service.deletePasskey("user1", "passkey1")
      ).rejects.toThrow("Passkey not found");
    });

    test("should throw error when deleting last passkey with no password", async () => {
      // Empty string represents no password (passkey-only account)
      const userWithoutPassword: User = { ...mockUser, passwordHash: "" };
      const mockUserRepoNoPassword: MockUserRepo = {
        ...mockUserRepo,
        findById: mock(() => Promise.resolve(userWithoutPassword)),
      };
      const mockRepoLastPasskey: MockPasskeyCredentialRepo = {
        ...mockPasskeyCredentialRepo,
        countByUserId: mock(() => Promise.resolve(1)), // Only one passkey
      };

      const service = new PasskeyService(
        mockRepoLastPasskey as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepoNoPassword as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      await expect(
        service.deletePasskey("user1", "passkey1")
      ).rejects.toThrow("Cannot delete the last passkey when no password is set");
    });

    test("should allow deleting last passkey when user has password", async () => {
      const mockRepoLastPasskey: MockPasskeyCredentialRepo = {
        ...mockPasskeyCredentialRepo,
        countByUserId: mock(() => Promise.resolve(1)), // Only one passkey
      };

      const service = new PasskeyService(
        mockRepoLastPasskey as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepo as IUserRepository, // User has password
        mockSessionRepo as ISessionRepository,
      );

      await service.deletePasskey("user1", "passkey1");

      expect(mockRepoLastPasskey.delete).toHaveBeenCalledWith("passkey1");
    });

    test("should throw error when user not found", async () => {
      const mockUserRepoEmpty: MockUserRepo = {
        ...mockUserRepo,
        findById: mock(() => Promise.resolve(null)),
      };

      const service = new PasskeyService(
        mockPasskeyCredentialRepo as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepoEmpty as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      await expect(
        service.deletePasskey("user1", "passkey1")
      ).rejects.toThrow("User not found");
    });
  });

  describe("renamePasskey", () => {
    test("should rename a passkey", async () => {
      const service = new PasskeyService(
        mockPasskeyCredentialRepo as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      const result = await service.renamePasskey("user1", "passkey1", "New Passkey Name");

      expect(result.name).toBe("New Name"); // From mock
      expect(mockPasskeyCredentialRepo.updateName).toHaveBeenCalledWith("passkey1", "New Passkey Name");
    });

    test("should throw error when passkey not found", async () => {
      const mockRepoEmpty: MockPasskeyCredentialRepo = {
        ...mockPasskeyCredentialRepo,
        findById: mock(() => Promise.resolve(null)),
      };

      const service = new PasskeyService(
        mockRepoEmpty as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      await expect(
        service.renamePasskey("user1", "nonexistent", "New Name")
      ).rejects.toThrow("Passkey not found");
    });

    test("should throw error when passkey belongs to different user", async () => {
      const wrongUserPasskey = { ...mockPasskey, userId: "user2" };
      const mockRepoWrongUser: MockPasskeyCredentialRepo = {
        ...mockPasskeyCredentialRepo,
        findById: mock(() => Promise.resolve(wrongUserPasskey)),
      };

      const service = new PasskeyService(
        mockRepoWrongUser as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      await expect(
        service.renamePasskey("user1", "passkey1", "New Name")
      ).rejects.toThrow("Passkey not found");
    });
  });

  describe("generateRegistrationOptions", () => {
    test("should throw error when user not found", async () => {
      const mockUserRepoEmpty: MockUserRepo = {
        ...mockUserRepo,
        findById: mock(() => Promise.resolve(null)),
      };

      const service = new PasskeyService(
        mockPasskeyCredentialRepo as IPasskeyCredentialRepository,
        mockPasskeyChallengeRepo as IPasskeyChallengeRepository,
        mockUserRepoEmpty as IUserRepository,
        mockSessionRepo as ISessionRepository,
      );

      await expect(
        service.generateRegistrationOptions("nonexistent")
      ).rejects.toThrow("User not found");
    });
  });
});
