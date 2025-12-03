import type { UserReport } from "../../db/schema/pg.js";

/**
 * Report status types
 */
export type ReportStatus = "pending" | "resolved" | "rejected";

/**
 * User Report Repository Interface
 *
 * Manages user reports for moderation.
 */
export interface IUserReportRepository {
  /**
   * Create a new report
   */
  create(data: {
    reporterId: string;
    targetUserId?: string;
    targetNoteId?: string;
    reason: string;
    comment?: string;
  }): Promise<UserReport>;

  /**
   * Find report by ID
   */
  findById(id: string): Promise<UserReport | null>;

  /**
   * List reports with filters
   */
  findAll(options?: {
    status?: ReportStatus;
    targetUserId?: string;
    reporterId?: string;
    limit?: number;
    offset?: number;
  }): Promise<UserReport[]>;

  /**
   * Count reports with filters
   */
  count(options?: {
    status?: ReportStatus;
    targetUserId?: string;
    reporterId?: string;
  }): Promise<number>;

  /**
   * Resolve a report
   */
  resolve(
    id: string,
    resolvedById: string,
    resolution: string,
    status: "resolved" | "rejected",
  ): Promise<UserReport | null>;

  /**
   * Delete a report
   */
  delete(id: string): Promise<boolean>;

  /**
   * Check if user has already reported this target
   */
  hasReported(reporterId: string, targetUserId?: string, targetNoteId?: string): Promise<boolean>;
}
