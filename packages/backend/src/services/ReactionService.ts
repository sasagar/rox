/**
 * Reaction Management Service
 *
 * Handles reaction creation, deletion, and retrieval.
 * Integrates with IReactionRepository for persistence and INoteRepository for note validation.
 *
 * @module services/ReactionService
 */

import type { IReactionRepository } from '../interfaces/repositories/IReactionRepository.js';
import type { INoteRepository } from '../interfaces/repositories/INoteRepository.js';
import type { IUserRepository } from '../interfaces/repositories/IUserRepository.js';
import type { Reaction } from '../../../shared/src/types/reaction.js';
import { generateId } from '../../../shared/src/utils/id.js';
import type { ActivityPubDeliveryService } from './ap/ActivityPubDeliveryService.js';

/**
 * Reaction creation input data
 */
export interface ReactionCreateInput {
  /** User ID creating the reaction */
  userId: string;
  /** Note ID to react to */
  noteId: string;
  /** Reaction emoji (Unicode emoji or custom emoji name) */
  reaction: string;
}

/**
 * Reaction Service
 *
 * Provides business logic for reaction operations including:
 * - Reaction creation with validation
 * - Duplicate reaction prevention
 * - Reaction deletion
 * - Reaction count aggregation
 *
 * @remarks
 * - One user can add multiple different reactions to a note
 * - Adding the same reaction twice has no effect (idempotent)
 * - Reaction must be a valid emoji (Unicode or custom emoji name)
 * - Maximum reaction string length: 100 characters
 */
export class ReactionService {
  private readonly maxReactionLength = 100;

  /**
   * ReactionService Constructor
   *
   * @param reactionRepository - Reaction repository
   * @param noteRepository - Note repository
   * @param userRepository - User repository
   * @param deliveryService - ActivityPub delivery service (injected via DI)
   */
  constructor(
    private readonly reactionRepository: IReactionRepository,
    private readonly noteRepository: INoteRepository,
    private readonly userRepository: IUserRepository,
    private readonly deliveryService: ActivityPubDeliveryService,
  ) {}

  /**
   * Create a reaction
   *
   * Validates the note exists and the reaction format, then creates the reaction.
   * If the user already has the same reaction on this note, it returns the existing one (idempotent).
   *
   * @param input - Reaction creation parameters
   * @returns Created or existing Reaction record
   * @throws Error if note not found
   * @throws Error if reaction format is invalid
   *
   * @example
   * ```typescript
   * const reaction = await reactionService.create({
   *   userId: user.id,
   *   noteId: 'note123',
   *   reaction: '👍',
   * });
   * ```
   *
   * @remarks
   * - Reaction can be Unicode emoji (👍, ❤️, etc.) or custom emoji name (:custom_emoji:)
   * - User can add multiple different reactions to the same note
   * - Adding the same reaction twice returns the existing reaction (idempotent)
   * - Maximum reaction string length: 100 characters
   */
  async create(input: ReactionCreateInput): Promise<Reaction> {
    const { userId, noteId, reaction } = input;

    // バリデーション: リアクション文字列長
    if (!reaction || reaction.length === 0) {
      throw new Error('Reaction cannot be empty');
    }

    if (reaction.length > this.maxReactionLength) {
      throw new Error(
        `Reaction exceeds maximum length of ${this.maxReactionLength} characters`,
      );
    }

    // ノートの存在確認
    const note = await this.noteRepository.findById(noteId);
    if (!note) {
      throw new Error('Note not found');
    }

    // 同じリアクションが既に存在するか確認
    const existingReaction = await this.reactionRepository.findByUserNoteAndReaction(
      userId,
      noteId,
      reaction,
    );

    // 既存のリアクションがあればそれを返す（冪等性）
    if (existingReaction) {
      return existingReaction;
    }

    // 新しいリアクションを作成
    const newReaction = await this.reactionRepository.create({
      id: generateId(),
      userId,
      noteId,
      reaction,
    });

    // Deliver Like activity to remote note author (async, non-blocking)
    const reactor = await this.userRepository.findById(userId);
    const noteAuthor = await this.userRepository.findById(note.userId);

    if (reactor && !reactor.host && noteAuthor && noteAuthor.host && noteAuthor.inbox) {
      // Only deliver if:
      // 1. Reactor is a local user (reactor.host is null)
      // 2. Note author is a remote user (noteAuthor.host is not null)
      // 3. Note author has an inbox URL
      this.deliveryService.deliverLikeActivity(
        note.id,
        note.uri || `${process.env.URL || 'http://localhost:3000'}/notes/${note.id}`,
        noteAuthor.inbox,
        reactor
      ).catch((error) => {
        console.error(`Failed to deliver Like activity for reaction ${newReaction.id}:`, error);
      });
    }

    return newReaction;
  }

  /**
   * Delete a specific reaction
   *
   * Removes the user's specific reaction from the note.
   *
   * @param userId - User ID who created the reaction
   * @param noteId - Note ID
   * @param reaction - Reaction emoji to delete
   * @throws Error if reaction not found
   *
   * @example
   * ```typescript
   * await reactionService.delete('user123', 'note456', '👍');
   * ```
   */
  async delete(userId: string, noteId: string, reaction: string): Promise<void> {
    // リアクションの存在確認
    const existingReaction = await this.reactionRepository.findByUserNoteAndReaction(
      userId,
      noteId,
      reaction,
    );

    if (!existingReaction) {
      throw new Error('Reaction not found');
    }

    // Get user and note data before deletion for ActivityPub delivery
    const reactor = await this.userRepository.findById(userId);
    const note = await this.noteRepository.findById(noteId);
    const noteAuthor = note ? await this.userRepository.findById(note.userId) : null;

    // Delete the reaction from local database
    await this.reactionRepository.deleteByUserNoteAndReaction(userId, noteId, reaction);

    // Deliver Undo Like activity to remote note author (async, non-blocking)
    if (reactor && note && noteAuthor && !reactor.host && noteAuthor.host) {
      // Only deliver if:
      // 1. Reactor is a local user (reactor.host is null)
      // 2. Note author is a remote user (noteAuthor.host is not null)
      this.deliveryService.deliverUndoLike(
        reactor,
        note,
        noteAuthor
      ).catch((error) => {
        console.error(`Failed to deliver Undo Like activity:`, error);
      });
    }
  }

  /**
   * Get all reactions for a note
   *
   * Returns all reactions for the specified note.
   *
   * @param noteId - Note ID
   * @param limit - Maximum number of reactions to retrieve (default: no limit)
   * @returns List of Reaction records
   *
   * @example
   * ```typescript
   * const reactions = await reactionService.getReactionsByNote('note123', 100);
   * ```
   */
  async getReactionsByNote(noteId: string, limit?: number): Promise<Reaction[]> {
    return await this.reactionRepository.findByNoteId(noteId, limit);
  }

  /**
   * Get reaction counts for a note
   *
   * Returns aggregated reaction counts grouped by emoji.
   *
   * @param noteId - Note ID
   * @returns Record of emoji to count (e.g., { "👍": 5, "❤️": 3 })
   *
   * @example
   * ```typescript
   * const counts = await reactionService.getReactionCounts('note123');
   * // => { "👍": 5, "❤️": 3, ":custom:": 2 }
   * ```
   */
  async getReactionCounts(noteId: string): Promise<Record<string, number>> {
    return await this.reactionRepository.countByNoteId(noteId);
  }

  /**
   * Get reaction counts with custom emoji URLs for a note
   *
   * Returns aggregated reaction counts and custom emoji image URLs.
   *
   * @param noteId - Note ID
   * @returns Object with counts and emojis
   *
   * @example
   * ```typescript
   * const result = await reactionService.getReactionCountsWithEmojis('note123');
   * // => {
   * //   counts: { "👍": 5, ":custom:": 2 },
   * //   emojis: { ":custom:": "https://example.com/emoji.png" }
   * // }
   * ```
   */
  async getReactionCountsWithEmojis(noteId: string): Promise<{
    counts: Record<string, number>;
    emojis: Record<string, string>;
  }> {
    return await this.reactionRepository.countByNoteIdWithEmojis(noteId);
  }

  /**
   * Get reaction counts for multiple notes
   *
   * Returns aggregated reaction counts for each note.
   *
   * @param noteIds - Array of note IDs
   * @returns Map of note ID to reaction counts
   *
   * @example
   * ```typescript
   * const counts = await reactionService.getReactionCountsForNotes(['note1', 'note2']);
   * // => Map {
   * //   'note1' => { "👍": 5, "❤️": 3 },
   * //   'note2' => { "👍": 2 }
   * // }
   * ```
   */
  async getReactionCountsForNotes(
    noteIds: string[],
  ): Promise<Map<string, Record<string, number>>> {
    return await this.reactionRepository.countByNoteIds(noteIds);
  }

  /**
   * Get user's reactions to a note
   *
   * Returns all reactions the user has added to the note.
   *
   * @param userId - User ID
   * @param noteId - Note ID
   * @returns Array of Reaction records
   *
   * @example
   * ```typescript
   * const myReactions = await reactionService.getUserReactions('user123', 'note456');
   * console.log(`You reacted with: ${myReactions.map(r => r.reaction).join(', ')}`);
   * ```
   */
  async getUserReactions(userId: string, noteId: string): Promise<Reaction[]> {
    return await this.reactionRepository.findByUserAndNoteAll(userId, noteId);
  }
}
