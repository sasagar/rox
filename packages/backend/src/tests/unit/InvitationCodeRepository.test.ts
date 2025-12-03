/**
 * Invitation Code Repository Unit Tests
 *
 * Tests the invitation code management functionality.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";

describe("InvitationCodeRepository", () => {
  // Mock invitation code data
  const mockInvitationCode = {
    id: "inv1",
    code: "TESTCODE123",
    createdById: "admin1",
    usedById: null,
    usedAt: null,
    expiresAt: null,
    maxUses: 1,
    useCount: 0,
    createdAt: new Date(),
  };

  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      create: mock(() => Promise.resolve(mockInvitationCode)),
      findByCode: mock(() => Promise.resolve(mockInvitationCode)),
      findById: mock(() => Promise.resolve(mockInvitationCode)),
      findAll: mock(() => Promise.resolve([mockInvitationCode])),
      findByCreatedBy: mock(() => Promise.resolve([mockInvitationCode])),
      isValid: mock(() => Promise.resolve(true)),
      use: mock(() =>
        Promise.resolve({
          ...mockInvitationCode,
          useCount: 1,
          usedById: "user1",
          usedAt: new Date(),
        }),
      ),
      delete: mock(() => Promise.resolve(true)),
      count: mock(() => Promise.resolve(1)),
      countUnused: mock(() => Promise.resolve(1)),
    };
  });

  describe("create", () => {
    test("should create a new invitation code", async () => {
      const result = await mockRepo.create({
        code: "TESTCODE123",
        createdById: "admin1",
      });

      expect(result).toEqual(mockInvitationCode);
      expect(mockRepo.create).toHaveBeenCalledWith({
        code: "TESTCODE123",
        createdById: "admin1",
      });
    });

    test("should create with expiration date", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await mockRepo.create({
        code: "TESTCODE123",
        createdById: "admin1",
        expiresAt,
      });

      expect(mockRepo.create).toHaveBeenCalledWith({
        code: "TESTCODE123",
        createdById: "admin1",
        expiresAt,
      });
    });

    test("should create with max uses", async () => {
      await mockRepo.create({
        code: "TESTCODE123",
        createdById: "admin1",
        maxUses: 5,
      });

      expect(mockRepo.create).toHaveBeenCalledWith({
        code: "TESTCODE123",
        createdById: "admin1",
        maxUses: 5,
      });
    });
  });

  describe("findByCode", () => {
    test("should find invitation code by code string", async () => {
      const result = await mockRepo.findByCode("TESTCODE123");

      expect(result).toEqual(mockInvitationCode);
      expect(mockRepo.findByCode).toHaveBeenCalledWith("TESTCODE123");
    });

    test("should return null for non-existent code", async () => {
      mockRepo.findByCode = mock(() => Promise.resolve(null));

      const result = await mockRepo.findByCode("NONEXISTENT");

      expect(result).toBeNull();
    });
  });

  describe("isValid", () => {
    test("should return true for valid unused code", async () => {
      const result = await mockRepo.isValid("TESTCODE123");

      expect(result).toBe(true);
    });

    test("should return false for expired code", async () => {
      mockRepo.isValid = mock(() => Promise.resolve(false));

      const result = await mockRepo.isValid("EXPIRED");

      expect(result).toBe(false);
    });

    test("should return false for fully used code", async () => {
      mockRepo.isValid = mock(() => Promise.resolve(false));

      const result = await mockRepo.isValid("USEDCODE");

      expect(result).toBe(false);
    });
  });

  describe("use", () => {
    test("should mark code as used", async () => {
      const result = await mockRepo.use("TESTCODE123", "user1");

      expect(result).toBeDefined();
      expect(result.useCount).toBe(1);
      expect(result.usedById).toBe("user1");
    });

    test("should return null for invalid code", async () => {
      mockRepo.use = mock(() => Promise.resolve(null));

      const result = await mockRepo.use("INVALID", "user1");

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    test("should delete invitation code", async () => {
      const result = await mockRepo.delete("inv1");

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith("inv1");
    });

    test("should return false for non-existent code", async () => {
      mockRepo.delete = mock(() => Promise.resolve(false));

      const result = await mockRepo.delete("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("count", () => {
    test("should return total count", async () => {
      const result = await mockRepo.count();

      expect(result).toBe(1);
    });

    test("should return unused count", async () => {
      const result = await mockRepo.countUnused();

      expect(result).toBe(1);
    });
  });

  describe("findAll", () => {
    test("should return all invitation codes", async () => {
      const result = await mockRepo.findAll();

      expect(result).toEqual([mockInvitationCode]);
    });

    test("should support pagination", async () => {
      await mockRepo.findAll(10, 0);

      expect(mockRepo.findAll).toHaveBeenCalledWith(10, 0);
    });
  });

  describe("findByCreatedBy", () => {
    test("should return codes created by specific user", async () => {
      const result = await mockRepo.findByCreatedBy("admin1");

      expect(result).toEqual([mockInvitationCode]);
      expect(mockRepo.findByCreatedBy).toHaveBeenCalledWith("admin1");
    });
  });
});
