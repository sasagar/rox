import type { ModerationAuditLog } from '../../db/schema/pg.js';

/**
 * Moderation action types
 */
export type ModerationAction =
  | 'delete_note'
  | 'restore_note'
  | 'suspend_user'
  | 'unsuspend_user'
  | 'resolve_report'
  | 'reject_report'
  | 'warn_user'
  | 'block_instance'
  | 'unblock_instance'
  | 'assign_role'
  | 'unassign_role';

/**
 * Target types for moderation actions
 */
export type ModerationTargetType = 'note' | 'user' | 'report' | 'instance' | 'role';

/**
 * Moderation Audit Log Repository Interface
 *
 * Manages audit logs for moderation actions.
 */
export interface IModerationAuditLogRepository {
  /**
   * Create a new audit log entry
   */
  create(data: {
    moderatorId: string;
    action: ModerationAction;
    targetType: ModerationTargetType;
    targetId: string;
    reason?: string;
    details?: Record<string, unknown>;
  }): Promise<ModerationAuditLog>;

  /**
   * Find audit log by ID
   */
  findById(id: string): Promise<ModerationAuditLog | null>;

  /**
   * List audit logs with filters
   */
  findAll(options?: {
    moderatorId?: string;
    action?: ModerationAction;
    targetType?: ModerationTargetType;
    targetId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationAuditLog[]>;

  /**
   * Count audit logs with filters
   */
  count(options?: {
    moderatorId?: string;
    action?: ModerationAction;
    targetType?: ModerationTargetType;
    targetId?: string;
  }): Promise<number>;

  /**
   * Get audit logs for a specific target
   */
  findByTarget(
    targetType: ModerationTargetType,
    targetId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ModerationAuditLog[]>;

  /**
   * Get audit logs by a specific moderator
   */
  findByModerator(
    moderatorId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ModerationAuditLog[]>;
}
