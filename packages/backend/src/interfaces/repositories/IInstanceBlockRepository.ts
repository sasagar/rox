import type { InstanceBlock } from "../../db/schema/pg.js";

/**
 * Instance Block Repository Interface
 *
 * Manages blocked instances for federation moderation.
 * Blocked instances are prevented from sending activities to this server.
 */
export interface IInstanceBlockRepository {
  /**
   * Block an instance
   *
   * @param block - Block details including host, reason, and admin ID
   * @returns Created block record
   */
  create(block: Omit<InstanceBlock, "id" | "createdAt">): Promise<InstanceBlock>;

  /**
   * Find a block by host
   *
   * @param host - Instance hostname to check
   * @returns Block record if exists, null otherwise
   */
  findByHost(host: string): Promise<InstanceBlock | null>;

  /**
   * Check if an instance is blocked
   *
   * @param host - Instance hostname to check
   * @returns True if blocked, false otherwise
   */
  isBlocked(host: string): Promise<boolean>;

  /**
   * Get all blocked instances
   *
   * @param limit - Maximum number of blocks to return (default: 100)
   * @param offset - Number of blocks to skip (default: 0)
   * @returns Array of block records
   */
  findAll(limit?: number, offset?: number): Promise<InstanceBlock[]>;

  /**
   * Unblock an instance
   *
   * @param host - Instance hostname to unblock
   * @returns True if unblocked, false if not found
   */
  deleteByHost(host: string): Promise<boolean>;

  /**
   * Count total blocked instances
   *
   * @returns Number of blocked instances
   */
  count(): Promise<number>;
}
