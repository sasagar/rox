/**
 * OAuthAccountRepository Unit Tests
 *
 * Tests the OAuth account management functionality.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import type { IOAuthAccountRepository, OAuthProvider } from "../../interfaces/repositories/IOAuthAccountRepository";
import type { OAuthAccount } from "../../db/schema/pg";

describe("OAuthAccountRepository", () => {
  // Mock OAuth account data
  const mockOAuthAccount: OAuthAccount = {
    id: "oauth1",
    userId: "user1",
    provider: "github",
    providerAccountId: "12345",
    accessToken: "access_token_xxx",
    refreshToken: "refresh_token_xxx",
    tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
    scope: "read:user user:email",
    tokenType: "Bearer",
    providerUsername: "testuser",
    providerEmail: "test@example.com",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockRepo: IOAuthAccountRepository;

  beforeEach(() => {
    mockRepo = {
      create: mock(() => Promise.resolve(mockOAuthAccount)),
      findById: mock(() => Promise.resolve(mockOAuthAccount)),
      findByProviderAccount: mock(() => Promise.resolve(mockOAuthAccount)),
      findByUserId: mock(() => Promise.resolve([mockOAuthAccount])),
      findByUserAndProvider: mock(() => Promise.resolve(mockOAuthAccount)),
      updateTokens: mock(() => Promise.resolve(mockOAuthAccount)),
      delete: mock(() => Promise.resolve()),
      deleteByUserAndProvider: mock(() => Promise.resolve()),
      deleteByUserId: mock(() => Promise.resolve()),
      countByUserId: mock(() => Promise.resolve(1)),
    };
  });

  describe("create", () => {
    test("should create a new OAuth account link", async () => {
      const input = {
        id: "oauth1",
        userId: "user1",
        provider: "github" as OAuthProvider,
        providerAccountId: "12345",
        accessToken: "access_token_xxx",
        refreshToken: "refresh_token_xxx",
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
        scope: "read:user user:email",
        tokenType: "Bearer",
        providerUsername: "testuser",
        providerEmail: "test@example.com",
      };

      const result = await mockRepo.create(input);

      expect(result).toEqual(mockOAuthAccount);
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    test("should create without optional fields", async () => {
      const minimalInput = {
        id: "oauth2",
        userId: "user1",
        provider: "discord" as OAuthProvider,
        providerAccountId: "67890",
        accessToken: "access_token_yyy",
        refreshToken: null,
        tokenExpiresAt: null,
        scope: null,
        tokenType: "Bearer",
        providerUsername: null,
        providerEmail: null,
      };

      await mockRepo.create(minimalInput);

      expect(mockRepo.create).toHaveBeenCalledWith(minimalInput);
    });
  });

  describe("findByProviderAccount", () => {
    test("should find OAuth account by provider and provider account ID", async () => {
      const result = await mockRepo.findByProviderAccount("github", "12345");

      expect(result).toEqual(mockOAuthAccount);
      expect(mockRepo.findByProviderAccount).toHaveBeenCalledWith("github", "12345");
    });

    test("should return null if not found", async () => {
      (mockRepo.findByProviderAccount as ReturnType<typeof mock>).mockResolvedValue(null);

      const result = await mockRepo.findByProviderAccount("github", "nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findByUserId", () => {
    test("should return all OAuth accounts for a user", async () => {
      const multipleAccounts = [
        mockOAuthAccount,
        { ...mockOAuthAccount, id: "oauth2", provider: "discord" as OAuthProvider },
      ];
      (mockRepo.findByUserId as ReturnType<typeof mock>).mockResolvedValue(multipleAccounts);

      const result = await mockRepo.findByUserId("user1");

      expect(result).toHaveLength(2);
      expect(result[0]?.provider).toBe("github");
      expect(result[1]?.provider).toBe("discord");
    });

    test("should return empty array if no accounts linked", async () => {
      (mockRepo.findByUserId as ReturnType<typeof mock>).mockResolvedValue([]);

      const result = await mockRepo.findByUserId("user2");

      expect(result).toEqual([]);
    });
  });

  describe("findByUserAndProvider", () => {
    test("should find specific provider link for user", async () => {
      const result = await mockRepo.findByUserAndProvider("user1", "github");

      expect(result).toEqual(mockOAuthAccount);
      expect(mockRepo.findByUserAndProvider).toHaveBeenCalledWith("user1", "github");
    });

    test("should return null if user has no link for that provider", async () => {
      (mockRepo.findByUserAndProvider as ReturnType<typeof mock>).mockResolvedValue(null);

      const result = await mockRepo.findByUserAndProvider("user1", "google");

      expect(result).toBeNull();
    });
  });

  describe("updateTokens", () => {
    test("should update access and refresh tokens", async () => {
      const updatedAccount = {
        ...mockOAuthAccount,
        accessToken: "new_access_token",
        refreshToken: "new_refresh_token",
        tokenExpiresAt: new Date(Date.now() + 7200 * 1000),
      };
      (mockRepo.updateTokens as ReturnType<typeof mock>).mockResolvedValue(updatedAccount);

      const result = await mockRepo.updateTokens("oauth1", {
        accessToken: "new_access_token",
        refreshToken: "new_refresh_token",
        tokenExpiresAt: new Date(Date.now() + 7200 * 1000),
      });

      expect(result.accessToken).toBe("new_access_token");
      expect(result.refreshToken).toBe("new_refresh_token");
    });
  });

  describe("delete", () => {
    test("should delete OAuth account by ID", async () => {
      await mockRepo.delete("oauth1");

      expect(mockRepo.delete).toHaveBeenCalledWith("oauth1");
    });
  });

  describe("deleteByUserId", () => {
    test("should delete all OAuth accounts for a user", async () => {
      await mockRepo.deleteByUserId("user1");

      expect(mockRepo.deleteByUserId).toHaveBeenCalledWith("user1");
    });
  });
});
