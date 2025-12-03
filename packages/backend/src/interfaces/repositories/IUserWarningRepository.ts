import type { UserWarning } from "../../db/schema/pg.js";

/**
 * User Warning Repository Interface
 *
 * Manages user warnings for moderation purposes.
 * Warnings are issued by moderators to notify users of policy violations.
 */
export interface IUserWarningRepository {
  /**
   * Create a new warning
   *
   * @param data - Warning data including userId, moderatorId, reason
   * @returns Created warning record
   */
  create(data: {
    userId: string;
    moderatorId: string;
    reason: string;
    expiresAt?: Date;
  }): Promise<UserWarning>;

  /**
   * Find a warning by ID
   *
   * @param id - Warning ID
   * @returns Warning record if found, null otherwise
   */
  findById(id: string): Promise<UserWarning | null>;

  /**
   * Find all warnings for a user
   *
   * @param userId - User ID
   * @param options - Pagination options
   * @returns Array of warning records
   */
  findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number; includeExpired?: boolean },
  ): Promise<UserWarning[]>;

  /**
   * Find all warnings issued by a moderator
   *
   * @param moderatorId - Moderator ID
   * @param options - Pagination options
   * @returns Array of warning records
   */
  findByModeratorId(
    moderatorId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<UserWarning[]>;

  /**
   * Find unread warnings for a user
   *
   * @param userId - User ID
   * @returns Array of unread warning records
   */
  findUnreadByUserId(userId: string): Promise<UserWarning[]>;

  /**
   * Mark a warning as read
   *
   * @param id - Warning ID
   * @returns Updated warning record if found, null otherwise
   */
  markAsRead(id: string): Promise<UserWarning | null>;

  /**
   * Mark all warnings for a user as read
   *
   * @param userId - User ID
   * @returns Number of warnings marked as read
   */
  markAllAsReadByUserId(userId: string): Promise<number>;

  /**
   * Count warnings for a user
   *
   * @param userId - User ID
   * @param options - Options to include expired warnings
   * @returns Number of warnings
   */
  countByUserId(
    userId: string,
    options?: { includeExpired?: boolean; unreadOnly?: boolean },
  ): Promise<number>;

  /**
   * Count total warnings
   *
   * @returns Total number of warnings
   */
  count(): Promise<number>;

  /**
   * Delete a warning
   *
   * @param id - Warning ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Find all warnings with pagination
   *
   * @param options - Query options
   * @returns Array of warning records
   */
  findAll(options?: {
    userId?: string;
    moderatorId?: string;
    limit?: number;
    offset?: number;
    includeExpired?: boolean;
  }): Promise<UserWarning[]>;
}
