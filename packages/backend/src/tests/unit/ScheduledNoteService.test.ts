/**
 * ScheduledNoteService Unit Tests
 *
 * Tests for scheduled note creation, update, cancellation, and publishing.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import { ScheduledNoteService } from "../../services/ScheduledNoteService.js";
import type { IScheduledNoteRepository } from "../../interfaces/repositories/IScheduledNoteRepository.js";
import type { RoleService } from "../../services/RoleService.js";
import type { NoteService } from "../../services/NoteService.js";
import type { ScheduledNote, ScheduledNoteStatus } from "../../db/schema/pg.js";

// Mock generateId
mock.module("../../lib/id.js", () => ({
  generateId: () => "generated-id",
}));

describe("ScheduledNoteService", () => {
  let scheduledNoteService: ScheduledNoteService;
  let mockScheduledNoteRepository: IScheduledNoteRepository;
  let mockRoleService: RoleService;
  let mockNoteService: NoteService;

  const createMockScheduledNote = (overrides: Partial<ScheduledNote> = {}): ScheduledNote => ({
    id: "sched1",
    userId: "user1",
    text: "Hello scheduled world!",
    cw: null,
    visibility: "public",
    localOnly: false,
    replyId: null,
    renoteId: null,
    fileIds: [],
    scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
    status: "pending" as ScheduledNoteStatus,
    publishedNoteId: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(() => {
    mockScheduledNoteRepository = {
      create: mock(() => Promise.resolve(createMockScheduledNote())),
      findById: mock(() => Promise.resolve(createMockScheduledNote())),
      findByUserId: mock(() => Promise.resolve([createMockScheduledNote()])),
      update: mock((_id: string, data: Partial<ScheduledNote>) =>
        Promise.resolve(createMockScheduledNote({ ...data })),
      ),
      delete: mock(() => Promise.resolve(true)),
      countPendingByUserId: mock(() => Promise.resolve(2)),
      findPendingToPublish: mock(() => Promise.resolve([createMockScheduledNote()])),
    } as unknown as IScheduledNoteRepository;

    mockRoleService = {
      getMaxScheduledNotes: mock(() => Promise.resolve(10)), // Allow up to 10
    } as unknown as RoleService;

    mockNoteService = {
      create: mock(() =>
        Promise.resolve({
          id: "note1",
          userId: "user1",
          text: "Hello scheduled world!",
          createdAt: new Date(),
        }),
      ),
    } as unknown as NoteService;

    scheduledNoteService = new ScheduledNoteService(
      mockScheduledNoteRepository,
      mockRoleService,
      mockNoteService,
    );
  });

  describe("create", () => {
    test("creates scheduled note successfully", async () => {
      const scheduledAt = new Date(Date.now() + 3600000); // 1 hour from now
      const result = await scheduledNoteService.create({
        userId: "user1",
        text: "Hello scheduled world!",
        visibility: "public",
        scheduledAt,
      });

      expect(result).toBeDefined();
      expect(mockScheduledNoteRepository.create).toHaveBeenCalled();
    });

    test("throws error when scheduled time is too soon", async () => {
      const scheduledAt = new Date(Date.now() + 30000); // 30 seconds from now

      await expect(
        scheduledNoteService.create({
          userId: "user1",
          text: "Too soon!",
          visibility: "public",
          scheduledAt,
        }),
      ).rejects.toThrow(/at least 1 minute in the future/);
    });

    test("throws error when scheduled time is in the past", async () => {
      const scheduledAt = new Date(Date.now() - 3600000); // 1 hour ago

      await expect(
        scheduledNoteService.create({
          userId: "user1",
          text: "Past!",
          visibility: "public",
          scheduledAt,
        }),
      ).rejects.toThrow(/at least 1 minute in the future/);
    });

    test("throws error when quota is exceeded", async () => {
      (mockRoleService.getMaxScheduledNotes as ReturnType<typeof mock>).mockResolvedValue(2);
      (mockScheduledNoteRepository.countPendingByUserId as ReturnType<typeof mock>).mockResolvedValue(
        2,
      );

      const scheduledAt = new Date(Date.now() + 3600000);

      await expect(
        scheduledNoteService.create({
          userId: "user1",
          text: "Over quota!",
          visibility: "public",
          scheduledAt,
        }),
      ).rejects.toThrow(/Maximum scheduled notes limit reached/);
    });

    test("allows creation when quota is unlimited (-1)", async () => {
      (mockRoleService.getMaxScheduledNotes as ReturnType<typeof mock>).mockResolvedValue(-1);
      (mockScheduledNoteRepository.countPendingByUserId as ReturnType<typeof mock>).mockResolvedValue(
        100,
      );

      const scheduledAt = new Date(Date.now() + 3600000);
      const result = await scheduledNoteService.create({
        userId: "user1",
        text: "Unlimited!",
        visibility: "public",
        scheduledAt,
      });

      expect(result).toBeDefined();
    });

    test("throws error when note has no content", async () => {
      const scheduledAt = new Date(Date.now() + 3600000);

      await expect(
        scheduledNoteService.create({
          userId: "user1",
          text: null,
          visibility: "public",
          scheduledAt,
        } as unknown as Parameters<typeof scheduledNoteService.create>[0]),
      ).rejects.toThrow(/must have text or attached files/);
    });

    test("allows note with files but no text", async () => {
      const scheduledAt = new Date(Date.now() + 3600000);
      const result = await scheduledNoteService.create({
        userId: "user1",
        text: null,
        fileIds: ["file1", "file2"],
        visibility: "public",
        scheduledAt,
      } as unknown as Parameters<typeof scheduledNoteService.create>[0]);

      expect(result).toBeDefined();
    });
  });

  describe("findById", () => {
    test("returns scheduled note when user owns it", async () => {
      const result = await scheduledNoteService.findById("sched1", "user1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("sched1");
    });

    test("returns null when scheduled note not found", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(null);

      const result = await scheduledNoteService.findById("nonexistent", "user1");

      expect(result).toBeNull();
    });

    test("returns null when user does not own scheduled note", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockScheduledNote({ userId: "otheruser" }),
      );

      const result = await scheduledNoteService.findById("sched1", "user1");

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    test("updates scheduled note successfully", async () => {
      const newScheduledAt = new Date(Date.now() + 7200000); // 2 hours from now
      const result = await scheduledNoteService.update("sched1", "user1", {
        text: "Updated text",
        scheduledAt: newScheduledAt,
      });

      expect(result).toBeDefined();
      expect(mockScheduledNoteRepository.update).toHaveBeenCalled();
    });

    test("throws error when scheduled note not found", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(null);

      await expect(
        scheduledNoteService.update("nonexistent", "user1", { text: "Updated" }),
      ).rejects.toThrow(/not found or access denied/);
    });

    test("throws error when user does not own scheduled note", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockScheduledNote({ userId: "otheruser" }),
      );

      await expect(
        scheduledNoteService.update("sched1", "user1", { text: "Updated" }),
      ).rejects.toThrow(/not found or access denied/);
    });

    test("throws error when scheduled note is not pending", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockScheduledNote({ status: "published" }),
      );

      await expect(
        scheduledNoteService.update("sched1", "user1", { text: "Updated" }),
      ).rejects.toThrow(/Only pending scheduled notes can be updated/);
    });

    test("throws error when new schedule time is too soon", async () => {
      const tooSoon = new Date(Date.now() + 30000);

      await expect(
        scheduledNoteService.update("sched1", "user1", { scheduledAt: tooSoon }),
      ).rejects.toThrow(/at least 1 minute in the future/);
    });

    test("throws error when update removes all content", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockScheduledNote({ fileIds: [] }),
      );

      await expect(
        scheduledNoteService.update("sched1", "user1", { text: null as unknown as string }),
      ).rejects.toThrow(/must have text or attached files/);
    });
  });

  describe("cancel", () => {
    test("cancels scheduled note successfully", async () => {
      const result = await scheduledNoteService.cancel("sched1", "user1");

      expect(result).toBeDefined();
      expect(mockScheduledNoteRepository.update).toHaveBeenCalled();
      const updateCall = (mockScheduledNoteRepository.update as ReturnType<typeof mock>).mock
        .calls[0];
      expect(updateCall?.[1].status).toBe("cancelled");
    });

    test("throws error when scheduled note not found", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(null);

      await expect(scheduledNoteService.cancel("nonexistent", "user1")).rejects.toThrow(
        /not found or access denied/,
      );
    });

    test("throws error when scheduled note is not pending", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockScheduledNote({ status: "published" }),
      );

      await expect(scheduledNoteService.cancel("sched1", "user1")).rejects.toThrow(
        /Only pending scheduled notes can be cancelled/,
      );
    });
  });

  describe("delete", () => {
    test("deletes cancelled scheduled note successfully", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockScheduledNote({ status: "cancelled" }),
      );

      await scheduledNoteService.delete("sched1", "user1");

      expect(mockScheduledNoteRepository.delete).toHaveBeenCalledWith("sched1");
    });

    test("deletes failed scheduled note successfully", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockScheduledNote({ status: "failed" }),
      );

      await scheduledNoteService.delete("sched1", "user1");

      expect(mockScheduledNoteRepository.delete).toHaveBeenCalledWith("sched1");
    });

    test("throws error when scheduled note not found", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(null);

      await expect(scheduledNoteService.delete("nonexistent", "user1")).rejects.toThrow(
        /not found or access denied/,
      );
    });

    test("throws error when scheduled note is pending", async () => {
      await expect(scheduledNoteService.delete("sched1", "user1")).rejects.toThrow(
        /Cancel the scheduled note before deleting/,
      );
    });

    test("throws error when scheduled note is published", async () => {
      (mockScheduledNoteRepository.findById as ReturnType<typeof mock>).mockResolvedValue(
        createMockScheduledNote({ status: "published" }),
      );

      await expect(scheduledNoteService.delete("sched1", "user1")).rejects.toThrow(
        /Published scheduled notes cannot be deleted/,
      );
    });
  });

  describe("publish", () => {
    test("publishes scheduled note successfully", async () => {
      const scheduledNote = createMockScheduledNote();
      const noteId = await scheduledNoteService.publish(scheduledNote);

      expect(noteId).toBe("note1");
      expect(mockNoteService.create).toHaveBeenCalled();
      expect(mockScheduledNoteRepository.update).toHaveBeenCalled();
      const updateCall = (mockScheduledNoteRepository.update as ReturnType<typeof mock>).mock
        .calls[0];
      expect(updateCall?.[1].status).toBe("published");
    });

    test("marks as failed when note creation fails", async () => {
      (mockNoteService.create as ReturnType<typeof mock>).mockRejectedValue(
        new Error("Creation failed"),
      );

      const scheduledNote = createMockScheduledNote();

      await expect(scheduledNoteService.publish(scheduledNote)).rejects.toThrow("Creation failed");

      expect(mockScheduledNoteRepository.update).toHaveBeenCalled();
      const updateCall = (mockScheduledNoteRepository.update as ReturnType<typeof mock>).mock
        .calls[0];
      expect(updateCall?.[1].status).toBe("failed");
      expect(updateCall?.[1].errorMessage).toBe("Creation failed");
    });

    test("throws error when NoteService is not available", async () => {
      // Create service without NoteService
      const serviceWithoutNote = new ScheduledNoteService(
        mockScheduledNoteRepository,
        mockRoleService,
      );

      const scheduledNote = createMockScheduledNote();

      await expect(serviceWithoutNote.publish(scheduledNote)).rejects.toThrow(
        /NoteService is required for publishing/,
      );
    });
  });

  describe("findPendingToPublish", () => {
    test("returns pending scheduled notes due for publication", async () => {
      const result = await scheduledNoteService.findPendingToPublish();

      expect(result).toHaveLength(1);
      expect(mockScheduledNoteRepository.findPendingToPublish).toHaveBeenCalled();
    });

    test("respects limit parameter", async () => {
      await scheduledNoteService.findPendingToPublish(50);

      const call = (mockScheduledNoteRepository.findPendingToPublish as ReturnType<typeof mock>).mock
        .calls[0];
      expect(call?.[1]).toBe(50);
    });
  });

  describe("countPending", () => {
    test("returns count of pending scheduled notes", async () => {
      const count = await scheduledNoteService.countPending("user1");

      expect(count).toBe(2);
      expect(mockScheduledNoteRepository.countPendingByUserId).toHaveBeenCalledWith("user1");
    });
  });
});
