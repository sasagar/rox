/**
 * Scheduled Note Publisher Service
 *
 * Background service that periodically checks for scheduled notes
 * that are due for publication and publishes them.
 *
 * @module services/ScheduledNotePublisher
 */

import type { ScheduledNoteService } from "./ScheduledNoteService.js";
import { createLogger } from "../lib/logger.js";

const logger = createLogger({ name: "ScheduledNotePublisher" });

/**
 * Publisher configuration
 */
interface PublisherConfig {
  /** Check interval in milliseconds (default: 30 seconds) */
  intervalMs: number;
  /** Maximum notes to process per batch (default: 50) */
  batchSize: number;
}

/**
 * Scheduled Note Publisher Service
 *
 * Automatically publishes scheduled notes when their scheduled time arrives.
 * Runs periodically based on the configured interval.
 *
 * @remarks
 * The default check interval is 30 seconds, which provides:
 * - Reasonable publish accuracy (notes published within ~30s of scheduled time)
 * - Low database load
 * - Good user experience
 *
 * @example
 * ```typescript
 * const publisher = new ScheduledNotePublisher(scheduledNoteService, {
 *   intervalMs: 30000, // 30 seconds
 *   batchSize: 50,
 * });
 *
 * publisher.start();
 * ```
 */
export class ScheduledNotePublisher {
  private config: PublisherConfig;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isProcessing: boolean = false;

  /**
   * Constructor
   *
   * @param scheduledNoteService - Scheduled note service for fetching and publishing notes
   * @param config - Publisher configuration
   */
  constructor(
    private readonly scheduledNoteService: ScheduledNoteService,
    config?: Partial<PublisherConfig>,
  ) {
    this.config = {
      intervalMs: config?.intervalMs ?? 30 * 1000, // 30 seconds default
      batchSize: config?.batchSize ?? 50,
    };
  }

  /**
   * Start the publisher service
   *
   * Begins periodic checking for scheduled notes to publish.
   * The first check runs immediately upon start.
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn("ScheduledNotePublisher is already running");
      return;
    }

    this.isRunning = true;
    logger.info(
      `Starting ScheduledNotePublisher (interval: ${this.config.intervalMs}ms, batch: ${this.config.batchSize})`,
    );

    // Run immediately on start
    this.processScheduledNotes().catch((error) => {
      logger.error({ err: error }, "Initial scheduled note processing failed");
    });

    // Schedule periodic processing
    this.intervalId = setInterval(() => {
      this.processScheduledNotes().catch((error) => {
        logger.error({ err: error }, "Scheduled note processing failed");
      });
    }, this.config.intervalMs);
  }

  /**
   * Stop the publisher service
   *
   * Stops the periodic checking interval.
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.warn("ScheduledNotePublisher is not running");
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    logger.info("Stopped ScheduledNotePublisher");
  }

  /**
   * Process scheduled notes that are due for publication
   *
   * Fetches pending notes whose scheduled time has passed
   * and attempts to publish them.
   *
   * @returns Number of notes processed
   *
   * @private
   */
  private async processScheduledNotes(): Promise<number> {
    // Prevent concurrent processing
    if (this.isProcessing) {
      logger.debug("Already processing scheduled notes, skipping this cycle");
      return 0;
    }

    this.isProcessing = true;

    try {
      // Fetch pending notes that are due
      const pendingNotes = await this.scheduledNoteService.findPendingToPublish(
        this.config.batchSize,
      );

      if (pendingNotes.length === 0) {
        return 0;
      }

      logger.info(`Found ${pendingNotes.length} scheduled notes to publish`);

      let successCount = 0;
      let failCount = 0;

      // Process each note
      for (const scheduledNote of pendingNotes) {
        try {
          const noteId = await this.scheduledNoteService.publish(scheduledNote);
          logger.info(`Published scheduled note ${scheduledNote.id} as note ${noteId}`);
          successCount++;
        } catch (error) {
          logger.error(
            {
              err: error instanceof Error ? error : new Error(String(error)),
              scheduledNoteId: scheduledNote.id,
              userId: scheduledNote.userId,
            },
            `Failed to publish scheduled note ${scheduledNote.id}`,
          );
          failCount++;
        }
      }

      if (successCount > 0 || failCount > 0) {
        logger.info(`Scheduled note processing complete: ${successCount} published, ${failCount} failed`);
      }

      return successCount;
    } catch (error) {
      logger.error({ err: error }, "Error in scheduled note processing");
      throw error;
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get current configuration
   *
   * @returns Current publisher configuration
   */
  public getConfig(): PublisherConfig {
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

  /**
   * Check if service is currently processing notes
   *
   * @returns True if currently processing
   */
  public isBusy(): boolean {
    return this.isProcessing;
  }

  /**
   * Trigger immediate processing (for testing or manual execution)
   *
   * @returns Number of notes published
   */
  public async triggerNow(): Promise<number> {
    return await this.processScheduledNotes();
  }
}
