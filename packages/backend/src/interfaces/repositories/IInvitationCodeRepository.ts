import type { InvitationCode } from '../../db/schema/pg.js';

/**
 * Invitation Code Repository Interface
 *
 * Manages invitation codes for invite-only registration.
 */
export interface IInvitationCodeRepository {
  /**
   * Create a new invitation code
   */
  create(data: {
    code: string;
    createdById: string;
    expiresAt?: Date;
    maxUses?: number;
  }): Promise<InvitationCode>;

  /**
   * Find invitation code by code string
   */
  findByCode(code: string): Promise<InvitationCode | null>;

  /**
   * Find invitation code by ID
   */
  findById(id: string): Promise<InvitationCode | null>;

  /**
   * List invitation codes created by a user
   */
  findByCreatedBy(userId: string, limit?: number, offset?: number): Promise<InvitationCode[]>;

  /**
   * List all invitation codes (admin)
   */
  findAll(limit?: number, offset?: number): Promise<InvitationCode[]>;

  /**
   * Check if an invitation code is valid (exists, not expired, not fully used)
   */
  isValid(code: string): Promise<boolean>;

  /**
   * Use an invitation code (increment use count, set usedById if single-use)
   */
  use(code: string, usedById: string): Promise<InvitationCode | null>;

  /**
   * Delete an invitation code
   */
  delete(id: string): Promise<boolean>;

  /**
   * Count invitation codes
   */
  count(): Promise<number>;

  /**
   * Count unused invitation codes
   */
  countUnused(): Promise<number>;

  /**
   * Count invitation codes created by a user within the last N hours
   * Used for rate limiting invitation creation
   */
  countRecentByCreator(userId: string, withinHours: number): Promise<number>;
}
