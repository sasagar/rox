/**
 * FileService Unit Tests
 *
 * Tests for file upload, retrieval, update, and deletion operations.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { FileService } from "../../services/FileService.js";
import type { IDriveFileRepository } from "../../interfaces/repositories/IDriveFileRepository.js";
import type { IFileStorage } from "../../interfaces/IFileStorage.js";
import type { RoleService } from "../../services/RoleService.js";
import type { DriveFile } from "../../db/schema/pg.js";

// Mock the ImageProcessor module
mock.module("../../services/ImageProcessor.js", () => ({
  getImageProcessor: () => ({
    isImage: () => false,
    process: mock(() => Promise.resolve({})),
  }),
}));

// Mock the generateId function
mock.module("../../lib/id.js", () => ({
  generateId: () => "generated-id",
}));

describe("FileService", () => {
  let fileService: FileService;
  let mockDriveFileRepository: IDriveFileRepository;
  let mockStorage: IFileStorage;
  let mockRoleService: RoleService;

  const createMockDriveFile = (overrides: Partial<DriveFile> = {}): DriveFile => ({
    id: "file1",
    userId: "user1",
    folderId: null,
    name: "test.txt",
    type: "text/plain",
    size: 100,
    md5: "abc123",
    url: "https://example.com/files/file1",
    thumbnailUrl: null,
    blurhash: null,
    comment: null,
    isSensitive: false,
    storageKey: "storage/file1",
    source: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockDriveFileRepository = {
      create: mock(() => Promise.resolve(createMockDriveFile())),
      findById: mock(() => Promise.resolve(createMockDriveFile())),
      findByUserId: mock(() => Promise.resolve([createMockDriveFile()])),
      update: mock((_id: string, data: Partial<DriveFile>) =>
        Promise.resolve(createMockDriveFile({ ...data })),
      ),
      delete: mock(() => Promise.resolve(true)),
      getTotalSize: mock(() => Promise.resolve(1000)),
      findByUrl: mock(() => Promise.resolve(null)),
      findByMd5: mock(() => Promise.resolve(null)),
    } as unknown as IDriveFileRepository;

    mockStorage = {
      save: mock(() => Promise.resolve("storage/newfile")),
      delete: mock(() => Promise.resolve()),
      getUrl: mock((key: string) => `https://example.com/${key}`),
    } as unknown as IFileStorage;

    mockRoleService = {
      getDriveCapacity: mock(() => Promise.resolve(100)), // 100MB quota
    } as unknown as RoleService;

    fileService = new FileService(mockDriveFileRepository, mockStorage, mockRoleService);
  });

  describe("upload", () => {
    test("uploads file successfully", async () => {
      const file = Buffer.from("test content");
      const result = await fileService.upload({
        file,
        name: "test.txt",
        type: "text/plain",
        userId: "user1",
      });

      expect(result).toBeDefined();
      expect(mockStorage.save).toHaveBeenCalled();
      expect(mockDriveFileRepository.create).toHaveBeenCalled();
    });

    test("throws error when file size exceeds limit", async () => {
      // Create a file larger than 10MB (default limit)
      const largeFile = Buffer.alloc(11 * 1024 * 1024);

      await expect(
        fileService.upload({
          file: largeFile,
          name: "large.bin",
          type: "application/octet-stream",
          userId: "user1",
        }),
      ).rejects.toThrow(/File size exceeds maximum allowed size/);
    });

    test("checks storage quota for user uploads", async () => {
      // Set current usage to 99MB
      (mockDriveFileRepository.getTotalSize as ReturnType<typeof mock>).mockResolvedValue(
        99 * 1024 * 1024,
      );
      // Set quota to 100MB
      (mockRoleService.getDriveCapacity as ReturnType<typeof mock>).mockResolvedValue(100);

      // 2MB file should exceed quota
      const file = Buffer.alloc(2 * 1024 * 1024);

      await expect(
        fileService.upload({
          file,
          name: "test.bin",
          type: "application/octet-stream",
          userId: "user1",
        }),
      ).rejects.toThrow(/Storage quota exceeded/);
    });

    test("skips quota check for unlimited quota (-1)", async () => {
      (mockRoleService.getDriveCapacity as ReturnType<typeof mock>).mockResolvedValue(-1);

      const file = Buffer.from("test content");
      const result = await fileService.upload({
        file,
        name: "test.txt",
        type: "text/plain",
        userId: "user1",
      });

      expect(result).toBeDefined();
    });

    test("skips quota check for system source", async () => {
      // Even with quota exceeded, system uploads should work
      (mockDriveFileRepository.getTotalSize as ReturnType<typeof mock>).mockResolvedValue(
        999 * 1024 * 1024,
      );

      const file = Buffer.from("test content");
      const result = await fileService.upload({
        file,
        name: "test.txt",
        type: "text/plain",
        userId: "user1",
        source: "system",
      });

      expect(result).toBeDefined();
    });

    test("sets isSensitive flag when provided", async () => {
      const file = Buffer.from("test content");
      await fileService.upload({
        file,
        name: "sensitive.txt",
        type: "text/plain",
        userId: "user1",
        isSensitive: true,
      });

      expect(mockDriveFileRepository.create).toHaveBeenCalled();
      const createCall = (mockDriveFileRepository.create as ReturnType<typeof mock>).mock.calls[0];
      expect(createCall?.[0].isSensitive).toBe(true);
    });
  });

  describe("findById", () => {
    test("returns file when user owns it", async () => {
      const file = await fileService.findById("file1", "user1");

      expect(file).not.toBeNull();
      expect(file?.id).toBe("file1");
    });

    test("returns null when file not found", async () => {
      (mockDriveFileRepository.findById as ReturnType<typeof mock>).mockResolvedValue(null);

      const file = await fileService.findById("nonexistent", "user1");

      expect(file).toBeNull();
    });

    test("returns null when user does not own file", async () => {
      (mockDriveFileRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockDriveFile({ userId: "otheruser" }),
      );

      const file = await fileService.findById("file1", "user1");

      expect(file).toBeNull();
    });
  });

  describe("listFiles", () => {
    test("returns files for user", async () => {
      const files = await fileService.listFiles("user1");

      expect(files).toHaveLength(1);
      expect(mockDriveFileRepository.findByUserId).toHaveBeenCalledWith("user1", {});
    });

    test("passes pagination options", async () => {
      await fileService.listFiles("user1", { limit: 10, sinceId: "file0" });

      expect(mockDriveFileRepository.findByUserId).toHaveBeenCalledWith("user1", {
        limit: 10,
        sinceId: "file0",
      });
    });
  });

  describe("update", () => {
    test("updates file metadata", async () => {
      const updated = await fileService.update("file1", "user1", {
        isSensitive: true,
        comment: "Updated comment",
      });

      expect(updated).toBeDefined();
      expect(mockDriveFileRepository.update).toHaveBeenCalled();
    });

    test("throws error when file not found", async () => {
      (mockDriveFileRepository.findById as ReturnType<typeof mock>).mockResolvedValue(null);

      await expect(
        fileService.update("nonexistent", "user1", { isSensitive: true }),
      ).rejects.toThrow(/File not found or access denied/);
    });

    test("throws error when user does not own file", async () => {
      (mockDriveFileRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockDriveFile({ userId: "otheruser" }),
      );

      await expect(fileService.update("file1", "user1", { isSensitive: true })).rejects.toThrow(
        /File not found or access denied/,
      );
    });
  });

  describe("delete", () => {
    test("deletes file from storage and database", async () => {
      await fileService.delete("file1", "user1");

      expect(mockStorage.delete).toHaveBeenCalledWith("storage/file1");
      expect(mockDriveFileRepository.delete).toHaveBeenCalledWith("file1");
    });

    test("throws error when file not found", async () => {
      (mockDriveFileRepository.findById as ReturnType<typeof mock>).mockResolvedValue(null);

      await expect(fileService.delete("nonexistent", "user1")).rejects.toThrow(
        /File not found or access denied/,
      );
    });

    test("throws error when user does not own file", async () => {
      (mockDriveFileRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockDriveFile({ userId: "otheruser" }),
      );

      await expect(fileService.delete("file1", "user1")).rejects.toThrow(
        /File not found or access denied/,
      );
    });
  });

  describe("getStorageUsage", () => {
    test("returns total storage usage for user", async () => {
      (mockDriveFileRepository.getTotalSize as ReturnType<typeof mock>).mockResolvedValue(5000);

      const usage = await fileService.getStorageUsage("user1");

      expect(usage).toBe(5000);
      expect(mockDriveFileRepository.getTotalSize).toHaveBeenCalledWith("user1");
    });
  });
});
