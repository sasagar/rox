import type { ScheduledNote, NewScheduledNote, ScheduledNoteStatus } from "../../db/schema/pg.js";

/**
 * Scheduled Note Repository Interface
 *
 * Provides data access methods for scheduled notes.
 */
export interface IScheduledNoteRepository {
  /**
   * Create a new scheduled note
   */
  create(input: NewScheduledNote): Promise<ScheduledNote>;

  /**
   * Find scheduled note by ID
   */
  findById(id: string): Promise<ScheduledNote | null>;

  /**
   * Find scheduled notes by user ID
   */
  findByUserId(
    userId: string,
    options?: {
      limit?: number;
      offset?: number;
      status?: ScheduledNoteStatus;
    },
  ): Promise<ScheduledNote[]>;

  /**
   * Count pending scheduled notes for a user
   */
  countPendingByUserId(userId: string): Promise<number>;

  /**
   * Find pending scheduled notes that are due for publication
   * @param before - Find notes scheduled before this time
   * @param limit - Maximum number of notes to return
   */
  findPendingToPublish(before: Date, limit: number): Promise<ScheduledNote[]>;

  /**
   * Update a scheduled note
   */
  update(
    id: string,
    input: Partial<Omit<ScheduledNote, "id" | "userId" | "createdAt">>,
  ): Promise<ScheduledNote | null>;

  /**
   * Delete a scheduled note
   */
  delete(id: string): Promise<boolean>;
}
