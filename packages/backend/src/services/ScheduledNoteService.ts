/**
 * Scheduled Note Service
 *
 * Handles scheduled note creation, retrieval, updates, and publication.
 * Integrates with RoleService for quota checks and NoteService for publishing.
 *
 * @module services/ScheduledNoteService
 */

import type { ScheduledNote, ScheduledNoteStatus } from "../db/schema/pg.js";
import type { IScheduledNoteRepository } from "../interfaces/repositories/IScheduledNoteRepository.js";
import type { RoleService } from "./RoleService.js";
import type { NoteService, NoteCreateInput } from "./NoteService.js";
import { generateId } from "../../../shared/src/utils/id.js";
import type { Visibility } from "../../../shared/src/types/common.js";

/**
 * Input for creating a scheduled note
 */
export interface ScheduledNoteCreateInput {
  /** User ID creating the note */
  userId: string;
  /** Note text content (can be null if files are attached) */
  text?: string | null;
  /** Content Warning text */
  cw?: string | null;
  /** Visibility level */
  visibility?: Visibility;
  /** Local-only flag (disable federation) */
  localOnly?: boolean;
  /** Reply target note ID */
  replyId?: string | null;
  /** Renote target note ID */
  renoteId?: string | null;
  /** File IDs to attach */
  fileIds?: string[];
  /** When to publish the note */
  scheduledAt: Date;
}

/**
 * Input for updating a scheduled note
 */
export interface ScheduledNoteUpdateInput {
  /** Note text content */
  text?: string | null;
  /** Content Warning text */
  cw?: string | null;
  /** Visibility level */
  visibility?: Visibility;
  /** Local-only flag */
  localOnly?: boolean;
  /** Reply target note ID */
  replyId?: string | null;
  /** Renote target note ID */
  renoteId?: string | null;
  /** File IDs to attach */
  fileIds?: string[];
  /** When to publish the note */
  scheduledAt?: Date;
}

/**
 * Scheduled Note Service
 *
 * Provides business logic for scheduled note operations including:
 * - Creating scheduled notes with quota validation
 * - Retrieving scheduled notes for a user
 * - Updating scheduled note content and schedule time
 * - Cancelling scheduled notes
 * - Publishing scheduled notes at their scheduled time
 *
 * @remarks
 * - Maximum scheduled notes per user is determined by role policies
 * - Scheduled notes must be scheduled at least 1 minute in the future
 * - Only pending notes can be updated or cancelled
 */
export class ScheduledNoteService {
  /** Minimum time in the future a note can be scheduled (1 minute) */
  private readonly minScheduleDelay = 60 * 1000;

  /**
   * ScheduledNoteService Constructor
   *
   * @param scheduledNoteRepository - Scheduled note repository
   * @param roleService - Role service for quota checks
   * @param noteService - Note service for publishing notes (optional, injected when publishing)
   */
  constructor(
    private readonly scheduledNoteRepository: IScheduledNoteRepository,
    private readonly roleService: RoleService,
    private readonly noteService?: NoteService,
  ) {}

  /**
   * Create a new scheduled note
   *
   * Validates the schedule time and checks quota before creating.
   *
   * @param input - Scheduled note creation parameters
   * @returns Created ScheduledNote record
   * @throws Error if schedule time is in the past or too soon
   * @throws Error if user has reached their scheduled note limit
   *
   * @example
   * ```typescript
   * const scheduled = await scheduledNoteService.create({
   *   userId: user.id,
   *   text: 'Hello from the future!',
   *   visibility: 'public',
   *   scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
   * });
   * ```
   */
  async create(input: ScheduledNoteCreateInput): Promise<ScheduledNote> {
    const { userId, scheduledAt } = input;

    // Validate schedule time is in the future
    const minScheduleTime = new Date(Date.now() + this.minScheduleDelay);
    if (scheduledAt < minScheduleTime) {
      throw new Error("Scheduled time must be at least 1 minute in the future");
    }

    // Check quota
    const maxScheduledNotes = await this.roleService.getMaxScheduledNotes(userId);
    const currentCount = await this.scheduledNoteRepository.countPendingByUserId(userId);

    // -1 means unlimited
    if (maxScheduledNotes !== -1 && currentCount >= maxScheduledNotes) {
      throw new Error(
        `Maximum scheduled notes limit reached (${currentCount}/${maxScheduledNotes}). Cancel or wait for existing scheduled notes to be published.`,
      );
    }

    // Validate content: must have text or files
    if (!input.text && (!input.fileIds || input.fileIds.length === 0)) {
      throw new Error("Note must have text or attached files");
    }

    const now = new Date();
    const scheduledNote = await this.scheduledNoteRepository.create({
      id: generateId(),
      userId,
      text: input.text ?? null,
      cw: input.cw ?? null,
      visibility: input.visibility ?? "public",
      localOnly: input.localOnly ?? false,
      replyId: input.replyId ?? null,
      renoteId: input.renoteId ?? null,
      fileIds: input.fileIds ?? [],
      scheduledAt,
      status: "pending",
      createdAt: now,
      updatedAt: now,
    });

    return scheduledNote;
  }

  /**
   * Get a scheduled note by ID
   *
   * @param id - Scheduled note ID
   * @param userId - User ID for ownership verification
   * @returns ScheduledNote record or null if not found/not owned
   */
  async findById(id: string, userId: string): Promise<ScheduledNote | null> {
    const scheduledNote = await this.scheduledNoteRepository.findById(id);

    // Verify ownership
    if (scheduledNote && scheduledNote.userId !== userId) {
      return null;
    }

    return scheduledNote;
  }

  /**
   * List scheduled notes for a user
   *
   * @param userId - User ID
   * @param options - Pagination and filtering options
   * @returns List of ScheduledNote records
   */
  async findByUserId(
    userId: string,
    options: {
      limit?: number;
      offset?: number;
      status?: ScheduledNoteStatus;
    } = {},
  ): Promise<ScheduledNote[]> {
    return await this.scheduledNoteRepository.findByUserId(userId, options);
  }

  /**
   * Update a scheduled note
   *
   * Only pending notes can be updated.
   *
   * @param id - Scheduled note ID
   * @param userId - User ID for ownership verification
   * @param input - Update parameters
   * @returns Updated ScheduledNote record
   * @throws Error if note not found or not owned
   * @throws Error if note is not in pending status
   * @throws Error if new schedule time is invalid
   */
  async update(
    id: string,
    userId: string,
    input: ScheduledNoteUpdateInput,
  ): Promise<ScheduledNote> {
    const scheduledNote = await this.findById(id, userId);

    if (!scheduledNote) {
      throw new Error("Scheduled note not found or access denied");
    }

    if (scheduledNote.status !== "pending") {
      throw new Error("Only pending scheduled notes can be updated");
    }

    // Validate new schedule time if provided
    if (input.scheduledAt) {
      const minScheduleTime = new Date(Date.now() + this.minScheduleDelay);
      if (input.scheduledAt < minScheduleTime) {
        throw new Error("Scheduled time must be at least 1 minute in the future");
      }
    }

    // Validate content: must have text or files after update
    const newText = input.text !== undefined ? input.text : scheduledNote.text;
    const newFileIds = input.fileIds !== undefined ? input.fileIds : scheduledNote.fileIds;
    if (!newText && (!newFileIds || newFileIds.length === 0)) {
      throw new Error("Note must have text or attached files");
    }

    const updateData: Partial<Omit<ScheduledNote, "id" | "userId" | "createdAt">> = {
      updatedAt: new Date(),
    };

    if (input.text !== undefined) updateData.text = input.text;
    if (input.cw !== undefined) updateData.cw = input.cw;
    if (input.visibility !== undefined) updateData.visibility = input.visibility;
    if (input.localOnly !== undefined) updateData.localOnly = input.localOnly;
    if (input.replyId !== undefined) updateData.replyId = input.replyId;
    if (input.renoteId !== undefined) updateData.renoteId = input.renoteId;
    if (input.fileIds !== undefined) updateData.fileIds = input.fileIds;
    if (input.scheduledAt !== undefined) updateData.scheduledAt = input.scheduledAt;

    const updated = await this.scheduledNoteRepository.update(id, updateData);

    if (!updated) {
      throw new Error("Failed to update scheduled note");
    }

    return updated;
  }

  /**
   * Cancel a scheduled note
   *
   * Only pending notes can be cancelled.
   *
   * @param id - Scheduled note ID
   * @param userId - User ID for ownership verification
   * @returns Updated ScheduledNote record with cancelled status
   * @throws Error if note not found or not owned
   * @throws Error if note is not in pending status
   */
  async cancel(id: string, userId: string): Promise<ScheduledNote> {
    const scheduledNote = await this.findById(id, userId);

    if (!scheduledNote) {
      throw new Error("Scheduled note not found or access denied");
    }

    if (scheduledNote.status !== "pending") {
      throw new Error("Only pending scheduled notes can be cancelled");
    }

    const updated = await this.scheduledNoteRepository.update(id, {
      status: "cancelled",
      updatedAt: new Date(),
    });

    if (!updated) {
      throw new Error("Failed to cancel scheduled note");
    }

    return updated;
  }

  /**
   * Delete a scheduled note
   *
   * Only cancelled or failed notes can be deleted.
   * Pending notes should be cancelled first.
   *
   * @param id - Scheduled note ID
   * @param userId - User ID for ownership verification
   * @throws Error if note not found or not owned
   * @throws Error if note is pending or published
   */
  async delete(id: string, userId: string): Promise<void> {
    const scheduledNote = await this.findById(id, userId);

    if (!scheduledNote) {
      throw new Error("Scheduled note not found or access denied");
    }

    if (scheduledNote.status === "pending") {
      throw new Error("Cancel the scheduled note before deleting");
    }

    if (scheduledNote.status === "published") {
      throw new Error("Published scheduled notes cannot be deleted");
    }

    const deleted = await this.scheduledNoteRepository.delete(id);

    if (!deleted) {
      throw new Error("Failed to delete scheduled note");
    }
  }

  /**
   * Publish a scheduled note
   *
   * Creates the actual note using NoteService and updates the scheduled note status.
   * This is typically called by the ScheduledNotePublisher background service.
   *
   * @param scheduledNote - The scheduled note to publish
   * @returns The created note ID
   * @throws Error if NoteService is not available
   * @throws Error if note creation fails
   */
  async publish(scheduledNote: ScheduledNote): Promise<string> {
    if (!this.noteService) {
      throw new Error("NoteService is required for publishing");
    }

    try {
      const noteInput: NoteCreateInput = {
        userId: scheduledNote.userId,
        text: scheduledNote.text,
        cw: scheduledNote.cw,
        visibility: scheduledNote.visibility as Visibility,
        localOnly: scheduledNote.localOnly,
        replyId: scheduledNote.replyId,
        renoteId: scheduledNote.renoteId,
        fileIds: scheduledNote.fileIds ?? [],
      };

      const note = await this.noteService.create(noteInput);

      // Update scheduled note status
      await this.scheduledNoteRepository.update(scheduledNote.id, {
        status: "published",
        publishedNoteId: note.id,
        updatedAt: new Date(),
      });

      return note.id;
    } catch (error) {
      // Mark as failed
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.scheduledNoteRepository.update(scheduledNote.id, {
        status: "failed",
        errorMessage,
        updatedAt: new Date(),
      });

      throw error;
    }
  }

  /**
   * Get pending scheduled notes that are due for publication
   *
   * This is used by the background publisher service.
   *
   * @param limit - Maximum number of notes to return
   * @returns List of ScheduledNote records ready to publish
   */
  async findPendingToPublish(limit = 100): Promise<ScheduledNote[]> {
    return await this.scheduledNoteRepository.findPendingToPublish(new Date(), limit);
  }

  /**
   * Count pending scheduled notes for a user
   *
   * @param userId - User ID
   * @returns Number of pending scheduled notes
   */
  async countPending(userId: string): Promise<number> {
    return await this.scheduledNoteRepository.countPendingByUserId(userId);
  }
}
