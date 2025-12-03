/**
 * User Report Repository Unit Tests
 *
 * Tests the user report/moderation functionality.
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";

describe("UserReportRepository", () => {
  // Mock report data
  const mockReport = {
    id: "report1",
    reporterId: "user1",
    targetUserId: "user2",
    targetNoteId: null,
    reason: "spam",
    comment: "This user is posting spam",
    status: "pending",
    resolvedById: null,
    resolvedAt: null,
    resolution: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockRepo: any;

  beforeEach(() => {
    mockRepo = {
      create: mock(() => Promise.resolve(mockReport)),
      findById: mock(() => Promise.resolve(mockReport)),
      findAll: mock(() => Promise.resolve([mockReport])),
      count: mock(() => Promise.resolve(1)),
      resolve: mock(() =>
        Promise.resolve({
          ...mockReport,
          status: "resolved",
          resolvedById: "admin1",
          resolvedAt: new Date(),
          resolution: "User warned",
        }),
      ),
      delete: mock(() => Promise.resolve(true)),
      hasReported: mock(() => Promise.resolve(false)),
    };
  });

  describe("create", () => {
    test("should create a user report", async () => {
      const result = await mockRepo.create({
        reporterId: "user1",
        targetUserId: "user2",
        reason: "spam",
        comment: "This user is posting spam",
      });

      expect(result).toEqual(mockReport);
      expect(mockRepo.create).toHaveBeenCalled();
    });

    test("should create a note report", async () => {
      const noteReport = {
        ...mockReport,
        targetUserId: null,
        targetNoteId: "note1",
      };
      mockRepo.create = mock(() => Promise.resolve(noteReport));

      const result = await mockRepo.create({
        reporterId: "user1",
        targetNoteId: "note1",
        reason: "harassment",
      });

      expect(result.targetNoteId).toBe("note1");
      expect(result.targetUserId).toBeNull();
    });

    test("should create report with valid reasons", async () => {
      const reasons = [
        "spam",
        "harassment",
        "hate_speech",
        "violence",
        "nsfw",
        "impersonation",
        "copyright",
        "other",
      ];

      for (const reason of reasons) {
        await mockRepo.create({
          reporterId: "user1",
          targetUserId: "user2",
          reason,
        });
      }

      expect(mockRepo.create).toHaveBeenCalledTimes(reasons.length);
    });
  });

  describe("findById", () => {
    test("should find report by ID", async () => {
      const result = await mockRepo.findById("report1");

      expect(result).toEqual(mockReport);
      expect(mockRepo.findById).toHaveBeenCalledWith("report1");
    });

    test("should return null for non-existent report", async () => {
      mockRepo.findById = mock(() => Promise.resolve(null));

      const result = await mockRepo.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    test("should return all reports", async () => {
      const result = await mockRepo.findAll();

      expect(result).toEqual([mockReport]);
    });

    test("should filter by status", async () => {
      await mockRepo.findAll({ status: "pending" });

      expect(mockRepo.findAll).toHaveBeenCalledWith({ status: "pending" });
    });

    test("should filter by target user", async () => {
      await mockRepo.findAll({ targetUserId: "user2" });

      expect(mockRepo.findAll).toHaveBeenCalledWith({ targetUserId: "user2" });
    });

    test("should filter by reporter", async () => {
      await mockRepo.findAll({ reporterId: "user1" });

      expect(mockRepo.findAll).toHaveBeenCalledWith({ reporterId: "user1" });
    });

    test("should support pagination", async () => {
      await mockRepo.findAll({ limit: 10, offset: 0 });

      expect(mockRepo.findAll).toHaveBeenCalledWith({ limit: 10, offset: 0 });
    });
  });

  describe("count", () => {
    test("should return total count", async () => {
      const result = await mockRepo.count();

      expect(result).toBe(1);
    });

    test("should filter count by status", async () => {
      await mockRepo.count({ status: "pending" });

      expect(mockRepo.count).toHaveBeenCalledWith({ status: "pending" });
    });
  });

  describe("resolve", () => {
    test("should resolve report as resolved", async () => {
      const result = await mockRepo.resolve("report1", "admin1", "User warned", "resolved");

      expect(result.status).toBe("resolved");
      expect(result.resolvedById).toBe("admin1");
      expect(result.resolution).toBe("User warned");
    });

    test("should reject report", async () => {
      mockRepo.resolve = mock(() =>
        Promise.resolve({
          ...mockReport,
          status: "rejected",
          resolvedById: "admin1",
          resolution: "Not a valid report",
        }),
      );

      const result = await mockRepo.resolve("report1", "admin1", "Not a valid report", "rejected");

      expect(result.status).toBe("rejected");
    });

    test("should return null for non-existent report", async () => {
      mockRepo.resolve = mock(() => Promise.resolve(null));

      const result = await mockRepo.resolve("nonexistent", "admin1", "Test", "resolved");

      expect(result).toBeNull();
    });
  });

  describe("delete", () => {
    test("should delete report", async () => {
      const result = await mockRepo.delete("report1");

      expect(result).toBe(true);
      expect(mockRepo.delete).toHaveBeenCalledWith("report1");
    });

    test("should return false for non-existent report", async () => {
      mockRepo.delete = mock(() => Promise.resolve(false));

      const result = await mockRepo.delete("nonexistent");

      expect(result).toBe(false);
    });
  });

  describe("hasReported", () => {
    test("should return false for first report", async () => {
      const result = await mockRepo.hasReported("user1", "user2");

      expect(result).toBe(false);
    });

    test("should return true for duplicate report", async () => {
      mockRepo.hasReported = mock(() => Promise.resolve(true));

      const result = await mockRepo.hasReported("user1", "user2");

      expect(result).toBe(true);
    });

    test("should check note reports", async () => {
      await mockRepo.hasReported("user1", undefined, "note1");

      expect(mockRepo.hasReported).toHaveBeenCalledWith("user1", undefined, "note1");
    });
  });
});
