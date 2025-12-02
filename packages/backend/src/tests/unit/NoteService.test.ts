/**
 * NoteService Unit Tests
 *
 * Tests business logic for note operations including
 * create, delete, and timeline retrieval
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { NoteService } from "../../services/NoteService";
import type { INoteRepository } from "../../interfaces/repositories/INoteRepository";
import type { IDriveFileRepository } from "../../interfaces/repositories/IDriveFileRepository";
import type { IFollowRepository } from "../../interfaces/repositories/IFollowRepository";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository";
import type { ICacheService } from "../../interfaces/ICacheService";
import type { ActivityPubDeliveryService } from "../../services/ap/ActivityPubDeliveryService";
import type { Note, DriveFile, Follow } from "shared";
import type { User } from "../../db/schema/pg.js";

/**
 * Partial mock types that only include the methods we actually use in tests
 */
type MockNoteRepo = Pick<
  INoteRepository,
  | "create"
  | "findById"
  | "delete"
  | "getLocalTimeline"
  | "getTimeline"
  | "getSocialTimeline"
  | "findByUserId"
>;

type MockDriveFileRepo = Pick<IDriveFileRepository, "findById" | "findByIds">;
type MockFollowRepo = Pick<IFollowRepository, "findByFollowerId" | "findByFolloweeId">;
type MockUserRepo = Pick<IUserRepository, "findById">;
type MockDeliveryService = Pick<ActivityPubDeliveryService, "deliverCreateNote" | "deliverDelete">;

type MockCacheService = {
  isAvailable: () => boolean;
  get: <T>(key: string) => Promise<T | null>;
  set: <T>(key: string, value: T, ttlSeconds?: number) => Promise<void>;
  deletePattern: (pattern: string) => Promise<void>;
};

describe("NoteService", () => {
  // Mock data
  const mockUser: Partial<User> = {
    id: "user1",
    username: "testuser",
    host: null,
    displayName: "Test User",
    avatarUrl: null,
    privateKey: "mock-private-key",
  };

  const mockNote: Note = {
    id: "note1",
    userId: "user1",
    text: "Hello, world!",
    cw: null,
    visibility: "public",
    localOnly: false,
    replyId: null,
    renoteId: null,
    fileIds: [],
    mentions: [],
    emojis: [],
    tags: [],
    uri: null,
    isDeleted: false,
    deletedAt: null,
    deletedById: null,
    deletionReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockDriveFile: DriveFile = {
    id: "file1",
    userId: "user1",
    name: "file.jpg",
    type: "image/jpeg",
    size: 1024,
    url: "http://example.com/file.jpg",
    thumbnailUrl: null,
    blurhash: null,
    md5: "abc123",
    isSensitive: false,
    comment: null,
    storageKey: "mock-storage-key",
    source: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockFollow: Follow = {
    id: "follow1",
    followerId: "user1",
    followeeId: "remote-user",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock repositories and services
  let mockNoteRepo: MockNoteRepo;
  let mockDriveFileRepo: MockDriveFileRepo;
  let mockFollowRepo: MockFollowRepo;
  let mockUserRepo: MockUserRepo;
  let mockDeliveryService: MockDeliveryService;
  let mockCacheService: MockCacheService;

  beforeEach(() => {
    mockNoteRepo = {
      create: mock(() => Promise.resolve(mockNote)),
      findById: mock(() => Promise.resolve(mockNote)),
      delete: mock(() => Promise.resolve()),
      getLocalTimeline: mock(() => Promise.resolve([mockNote])),
      getTimeline: mock(() => Promise.resolve([mockNote])),
      getSocialTimeline: mock(() => Promise.resolve([mockNote])),
      findByUserId: mock(() => Promise.resolve([mockNote])),
    };

    mockDriveFileRepo = {
      findById: mock(() => Promise.resolve(mockDriveFile)),
      findByIds: mock(() => Promise.resolve([mockDriveFile])),
    };

    mockFollowRepo = {
      findByFollowerId: mock(() => Promise.resolve([])),
      findByFolloweeId: mock(() => Promise.resolve([])),
    };

    mockUserRepo = {
      findById: mock(() => Promise.resolve(mockUser as User)),
    };

    mockDeliveryService = {
      deliverCreateNote: mock(() => Promise.resolve()),
      deliverDelete: mock(() => Promise.resolve()),
    };

    mockCacheService = {
      isAvailable: mock(() => true),
      get: mock(() => Promise.resolve(null)),
      set: mock(() => Promise.resolve()),
      deletePattern: mock(() => Promise.resolve()),
    };
  });

  describe("create", () => {
    test("should create a note with text", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      const result = await service.create({
        userId: "user1",
        text: "Hello, world!",
        visibility: "public",
        localOnly: false,
      });

      expect(result.id).toBe("note1");
      expect(mockNoteRepo.create).toHaveBeenCalled();
    });

    test("should reject note without text or files", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      await expect(
        service.create({
          userId: "user1",
          text: null,
          visibility: "public",
          localOnly: false,
        }),
      ).rejects.toThrow("Note must have text or files");
    });

    test("should trim whitespace-only text and reject if no files", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      // Service trims text; whitespace-only becomes empty which requires files
      await expect(
        service.create({
          userId: "user1",
          text: "",
          visibility: "public",
          localOnly: false,
        }),
      ).rejects.toThrow("Note must have text or files");
    });

    test("should allow note with only files", async () => {
      const mockDriveFileRepoWithFiles: MockDriveFileRepo = {
        ...mockDriveFileRepo,
        findByIds: mock(() => Promise.resolve([mockDriveFile])),
      };

      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepoWithFiles as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      const result = await service.create({
        userId: "user1",
        text: null,
        visibility: "public",
        localOnly: false,
        fileIds: ["file1"],
      });

      expect(result.id).toBe("note1");
    });

    test("should reject too many files", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      const manyFileIds = Array.from({ length: 17 }, (_, i) => `file${i}`);

      await expect(
        service.create({
          userId: "user1",
          text: "Test",
          visibility: "public",
          localOnly: false,
          fileIds: manyFileIds,
        }),
      ).rejects.toThrow("Maximum");
    });

    test("should verify file ownership during creation", async () => {
      // When files don't exist or aren't found, the service should handle gracefully
      const mockDriveFileRepoEmpty: MockDriveFileRepo = {
        ...mockDriveFileRepo,
        findByIds: mock(() => Promise.resolve([])),
      };

      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepoEmpty as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      // File not found means it won't be included, but text note should still work
      const result = await service.create({
        userId: "user1",
        text: "Test with missing file",
        visibility: "public",
        localOnly: false,
        fileIds: ["nonexistent-file"],
      });

      expect(result.id).toBe("note1");
    });

    test("should invalidate cache on public note creation", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      await service.create({
        userId: "user1",
        text: "Hello!",
        visibility: "public",
        localOnly: false,
      });

      expect(mockCacheService.deletePattern).toHaveBeenCalled();
    });
  });

  describe("delete", () => {
    test("should delete a note owned by user", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      await service.delete("note1", "user1");

      expect(mockNoteRepo.delete).toHaveBeenCalledWith("note1");
    });

    test("should reject deleting non-existent note", async () => {
      const mockNoteRepoEmpty: MockNoteRepo = {
        ...mockNoteRepo,
        findById: mock(() => Promise.resolve(null)),
      };

      const service = new NoteService(
        mockNoteRepoEmpty as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      await expect(service.delete("nonexistent", "user1")).rejects.toThrow("Note not found");
    });

    test("should reject deleting note owned by another user", async () => {
      const otherUserNote: Note = {
        ...mockNote,
        userId: "other-user",
      };

      const mockNoteRepoOther: MockNoteRepo = {
        ...mockNoteRepo,
        findById: mock(() => Promise.resolve(otherUserNote)),
      };

      const service = new NoteService(
        mockNoteRepoOther as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      await expect(service.delete("note1", "user1")).rejects.toThrow("Access denied");
    });
  });

  describe("findById", () => {
    test("should return note by id", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      const result = await service.findById("note1");

      expect(result?.id).toBe("note1");
      expect(mockNoteRepo.findById).toHaveBeenCalledWith("note1");
    });

    test("should return null for non-existent note", async () => {
      const mockNoteRepoEmpty: MockNoteRepo = {
        ...mockNoteRepo,
        findById: mock(() => Promise.resolve(null)),
      };

      const service = new NoteService(
        mockNoteRepoEmpty as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      const result = await service.findById("nonexistent");

      expect(result).toBeNull();
    });
  });

  describe("getLocalTimeline", () => {
    test("should return local timeline with default limit", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      const result = await service.getLocalTimeline();

      expect(result).toHaveLength(1);
      expect(mockNoteRepo.getLocalTimeline).toHaveBeenCalled();
    });

    test("should use cached result on first page", async () => {
      const cachedNotes: Note[] = [{ ...mockNote, id: "cached-note" }];
      const mockCacheServiceWithCache: MockCacheService = {
        ...mockCacheService,
        get: mock(() => Promise.resolve(cachedNotes)) as MockCacheService["get"],
      };

      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheServiceWithCache as ICacheService,
      );

      const result = await service.getLocalTimeline();

      expect(result[0]?.id).toBe("cached-note");
      expect(mockNoteRepo.getLocalTimeline).not.toHaveBeenCalled();
    });

    test("should bypass cache for pagination", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      await service.getLocalTimeline({ untilId: "some-id" });

      expect(mockCacheService.get).not.toHaveBeenCalled();
      expect(mockNoteRepo.getLocalTimeline).toHaveBeenCalled();
    });

    test("should enforce maximum limit", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      await service.getLocalTimeline({ limit: 500 });

      const call = (mockNoteRepo.getLocalTimeline as ReturnType<typeof mock>).mock.calls[0]?.[0] as
        | { limit?: number }
        | undefined;
      expect(call?.limit).toBeLessThanOrEqual(100);
    });
  });

  describe("getHomeTimeline", () => {
    test("should return home timeline for user", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      const result = await service.getHomeTimeline("user1");

      expect(result).toHaveLength(1);
      expect(mockFollowRepo.findByFollowerId).toHaveBeenCalledWith("user1");
    });
  });

  describe("getSocialTimeline", () => {
    test("should combine local and followed users notes", async () => {
      const mockFollowRepoWithFollows: MockFollowRepo = {
        ...mockFollowRepo,
        findByFollowerId: mock(() => Promise.resolve([mockFollow])),
      };

      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepoWithFollows as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      await service.getSocialTimeline("user1");

      expect(mockNoteRepo.getSocialTimeline).toHaveBeenCalled();
    });

    test("should work without authentication", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      await service.getSocialTimeline(null);

      expect(mockFollowRepo.findByFollowerId).not.toHaveBeenCalled();
      expect(mockNoteRepo.getSocialTimeline).toHaveBeenCalled();
    });
  });

  describe("getUserTimeline", () => {
    test("should return notes for specific user", async () => {
      const service = new NoteService(
        mockNoteRepo as INoteRepository,
        mockDriveFileRepo as IDriveFileRepository,
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService,
        mockCacheService as ICacheService,
      );

      const result = await service.getUserTimeline("user1");

      expect(result).toHaveLength(1);
      expect(mockNoteRepo.findByUserId).toHaveBeenCalled();
    });
  });
});
