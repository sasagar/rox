/**
 * Received Activities Cleanup Service
 *
 * Periodically removes old entries from the received_activities table
 * to prevent unlimited growth and maintain database performance.
 *
 * @module services/ReceivedActivitiesCleanupService
 */

import { getDatabase } from "../db/index.js";
import { receivedActivities } from "../db/schema/pg.js";
import { lt } from "drizzle-orm";
import { logger } from "../lib/logger.js";

/**
 * Cleanup configuration
 */
interface CleanupConfig {
  /** Retention period in days (default: 7 days) */
  retentionDays: number;
  /** Cleanup interval in milliseconds (default: 24 hours) */
  intervalMs: number;
}

/**
 * Received Activities Cleanup Service
 *
 * Automatically removes received activity records older than the retention period.
 * Runs periodically based on the configured interval.
 *
 * @remarks
 * The default retention period is 7 days, which is sufficient for:
 * - Preventing duplicate processing of retried deliveries
 * - Handling network delays and retry attempts
 * - Keeping database size manageable
 *
 * @example
 * ```typescript
 * const cleanup = new ReceivedActivitiesCleanupService({
 *   retentionDays: 7,
 *   intervalMs: 24 * 60 * 60 * 1000, // 24 hours
 * });
 *
 * cleanup.start();
 * ```
 */
export class ReceivedActivitiesCleanupService {
  private config: CleanupConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  /**
   * Constructor
   *
   * @param config - Cleanup configuration
   */
  constructor(config?: Partial<CleanupConfig>) {
    this.config = {
      retentionDays: config?.retentionDays ?? 7,
      intervalMs: config?.intervalMs ?? 24 * 60 * 60 * 1000, // 24 hours default
    };
  }

  /**
   * Start the cleanup service
   *
   * Begins periodic cleanup based on the configured interval.
   * The first cleanup runs immediately upon start.
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn("ReceivedActivitiesCleanupService is already running");
      return;
    }

    this.isRunning = true;
    logger.info(
      { retentionDays: this.config.retentionDays, intervalMs: this.config.intervalMs },
      "Starting ReceivedActivitiesCleanupService",
    );

    // Run cleanup immediately on start
    this.cleanup().catch((error) => {
      logger.error({ err: error }, "Initial cleanup failed");
    });

    // Schedule periodic cleanup
    this.intervalId = setInterval(() => {
      this.cleanup().catch((error) => {
        logger.error({ err: error }, "Scheduled cleanup failed");
      });
    }, this.config.intervalMs);
  }

  /**
   * Stop the cleanup service
   *
   * Stops the periodic cleanup interval.
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.warn("ReceivedActivitiesCleanupService is not running");
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info("Stopped ReceivedActivitiesCleanupService");
  }

  /**
   * Perform cleanup
   *
   * Removes received activity records older than the retention period.
   *
   * @returns Number of records deleted
   *
   * @private
   */
  private async cleanup(): Promise<number> {
    try {
      // Calculate cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      logger.debug({ cutoffDate: cutoffDate.toISOString() }, "Cleaning up received_activities");

      const db = getDatabase();

      // Delete old entries
      await db.delete(receivedActivities).where(lt(receivedActivities.receivedAt, cutoffDate));

      logger.debug("Cleanup completed");

      return 0; // Return 0 as we don't have a reliable way to get the count across all DB types
    } catch (error) {
      logger.error({ err: error }, "Cleanup failed");
      throw error;
    }
  }

  /**
   * Get current configuration
   *
   * @returns Current cleanup configuration
   */
  public getConfig(): CleanupConfig {
    return { ...this.config };
  }

  /**
   * Check if service is running
   *
   * @returns True if service is currently running
   */
  public isActive(): boolean {
    return this.isRunning;
  }
}
