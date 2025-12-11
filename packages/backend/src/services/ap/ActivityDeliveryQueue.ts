/**
 * ActivityPub Activity Delivery Queue
 *
 * Manages asynchronous delivery of ActivityPub activities to remote servers.
 * Uses BullMQ when Redis is available, falls back to sync delivery otherwise.
 *
 * @module services/ap/ActivityDeliveryQueue
 */

import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { ActivityDeliveryService } from "./ActivityDeliveryService.js";
import { logger } from "../../lib/logger.js";

/**
 * Job priority levels
 */
export enum JobPriority {
  /** Urgent: Follow, Accept, Reject, Undo activities (immediate user actions) */
  URGENT = 1,
  /** Normal: Like, Announce, Create activities (content distribution) */
  NORMAL = 5,
  /** Low: Update, Delete activities (cleanup operations) */
  LOW = 10,
}

/**
 * Rate limit configuration per server
 */
interface RateLimitConfig {
  /** Maximum deliveries per window (default: 10) */
  maxDeliveries: number;
  /** Time window in milliseconds (default: 1000ms = 1 second) */
  windowMs: number;
}

/**
 * Rate limit state for a server
 */
interface RateLimitState {
  /** Hostname of the server */
  hostname: string;
  /** Timestamps of recent deliveries (within window) */
  deliveries: number[];
  /** Last cleanup time */
  lastCleanup: number;
}

/**
 * Delivery job data structure
 */
export interface DeliveryJobData {
  /** ActivityPub activity to deliver */
  activity: any;
  /** Target inbox URL */
  inboxUrl: string;
  /** Sender's key ID for HTTP Signature */
  keyId: string;
  /** Sender's private key for HTTP Signature */
  privateKey: string;
  /** Job priority (optional, defaults to NORMAL) */
  priority?: JobPriority;
}

/**
 * Activity Delivery Queue Service
 *
 * Handles queuing and processing of ActivityPub activity deliveries.
 *
 * Features:
 * - Asynchronous delivery via BullMQ (when Redis available)
 * - Automatic retry with exponential backoff
 * - Fallback to synchronous delivery (development mode)
 *
 * @example
 * ```typescript
 * const queue = ActivityDeliveryQueue.getInstance();
 * await queue.enqueue({
 *   activity: likeActivity,
 *   inboxUrl: 'https://remote.example/inbox',
 *   keyId: 'https://local.example/users/alice#main-key',
 *   privateKey: alicePrivateKey,
 * });
 * ```
 */
export class ActivityDeliveryQueue {
  private queue: Queue<DeliveryJobData> | null = null;
  private worker: Worker<DeliveryJobData> | null = null;
  private redis: Redis | null = null;
  private deliveryService: ActivityDeliveryService;
  private useQueue: boolean = false;
  private initPromise: Promise<void>;
  private deliveryMetrics: Map<string, { success: number; failure: number }> = new Map();
  private rateLimits: Map<string, RateLimitState> = new Map();
  private rateLimitConfig: RateLimitConfig = {
    maxDeliveries: 10, // 10 deliveries per second per server
    windowMs: 1000, // 1 second window
  };
  private statsInterval: NodeJS.Timeout | null = null;

  /**
   * Constructor
   *
   * Creates a new ActivityDeliveryQueue instance and initializes Redis connection.
   * Optionally starts periodic statistics logging.
   *
   * @param enableStatsLogging - Enable periodic statistics logging (default: true in production)
   */
  constructor(enableStatsLogging: boolean = process.env.NODE_ENV === "production") {
    this.deliveryService = new ActivityDeliveryService();
    this.initPromise = this.initializeQueue();

    // Start periodic statistics logging if enabled
    if (enableStatsLogging) {
      this.startPeriodicStatsLogging();
    }
  }

  /**
   * Wait for initialization to complete
   *
   * @returns Promise that resolves when initialization is complete
   */
  public async waitForInit(): Promise<void> {
    await this.initPromise;
  }

  /**
   * Check if queue mode is enabled (vs synchronous delivery)
   *
   * @returns True if using Redis queue, false if using synchronous delivery
   */
  public isQueueEnabled(): boolean {
    return this.useQueue;
  }

  /**
   * Initialize BullMQ queue and worker
   *
   * Attempts to connect to Redis. If connection fails, falls back to sync mode.
   *
   * @private
   */
  private async initializeQueue(): Promise<void> {
    // Check if queue is explicitly disabled via environment variable
    if (process.env.USE_QUEUE === "false") {
      logger.debug("Queue disabled via USE_QUEUE=false, using synchronous delivery");
      this.useQueue = false;
      return;
    }

    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    try {
      // Attempt to connect to Redis
      // Note: maxRetriesPerRequest must be null for BullMQ compatibility
      // BullMQ handles its own retry logic and requires this setting
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: null, // Required for BullMQ
        retryStrategy: (times) => {
          if (times > 3) return null; // Give up after 3 attempts
          return Math.min(times * 100, 1000); // Exponential backoff up to 1 second
        },
        connectTimeout: 5000,
        enableOfflineQueue: false, // Fail fast if connection is not ready
      });

      // Wait for connection to be ready
      await new Promise<void>((resolve, reject) => {
        this.redis!.once("ready", () => resolve());
        this.redis!.once("error", (err) => reject(err));
      });

      logger.debug("Redis connected, using BullMQ for delivery queue");

      // Initialize queue
      // Note: Using simple prefix without hash tags for Dragonfly compatibility
      // Hash tags like {ap} cause "undeclared key" errors in Dragonfly's Lua scripts
      this.queue = new Queue<DeliveryJobData>("activitypub-delivery", {
        connection: this.redis,
        prefix: "bull",
      });

      // Initialize worker
      this.worker = new Worker<DeliveryJobData>(
        "activitypub-delivery",
        async (job: Job<DeliveryJobData>) => {
          await this.processJob(job);
        },
        {
          connection: this.redis,
          prefix: "bull",
          concurrency: 10, // Process up to 10 jobs concurrently
        },
      );

      this.worker.on("failed", (job, err) => {
        logger.error({ err, jobId: job?.id }, "Delivery job failed");
      });

      this.useQueue = true;
    } catch (error) {
      logger.debug({ err: error }, "Redis not available, using synchronous delivery fallback");
      this.useQueue = false;

      // Clean up failed connection
      if (this.redis) {
        this.redis.disconnect();
        this.redis = null;
      }
    }
  }

  /**
   * Extract hostname from inbox URL
   *
   * @param inboxUrl - Target inbox URL
   * @returns Hostname (e.g., "mastodon.social")
   *
   * @private
   */
  private extractHostname(inboxUrl: string): string {
    try {
      return new URL(inboxUrl).hostname;
    } catch {
      return inboxUrl; // Fallback to full URL if parsing fails
    }
  }

  /**
   * Check if delivery is allowed under rate limit
   *
   * Implements sliding window rate limiting per server.
   *
   * @param hostname - Target server hostname
   * @returns True if delivery is allowed, false if rate limit exceeded
   *
   * @private
   */
  private checkRateLimit(hostname: string): boolean {
    const now = Date.now();
    let state = this.rateLimits.get(hostname);

    // Initialize state if not exists
    if (!state) {
      state = {
        hostname,
        deliveries: [],
        lastCleanup: now,
      };
      this.rateLimits.set(hostname, state);
    }

    // Cleanup old deliveries (outside window)
    const windowStart = now - this.rateLimitConfig.windowMs;
    state.deliveries = state.deliveries.filter((timestamp) => timestamp > windowStart);
    state.lastCleanup = now;

    // Check if we're under the limit
    if (state.deliveries.length >= this.rateLimitConfig.maxDeliveries) {
      return false; // Rate limit exceeded
    }

    // Record this delivery
    state.deliveries.push(now);
    return true;
  }

  /**
   * Calculate delay needed to respect rate limit
   *
   * Returns the minimum delay (in milliseconds) needed before the next
   * delivery to this server can proceed.
   *
   * @param hostname - Target server hostname
   * @returns Delay in milliseconds (0 if no delay needed)
   *
   * @private
   */
  private calculateRateLimitDelay(hostname: string): number {
    const state = this.rateLimits.get(hostname);
    if (!state || state.deliveries.length < this.rateLimitConfig.maxDeliveries) {
      return 0; // No delay needed
    }

    // Find the oldest delivery in the window
    const oldestDelivery = Math.min(...state.deliveries);
    const windowStart = Date.now() - this.rateLimitConfig.windowMs;

    // If oldest delivery is still within window, calculate delay
    if (oldestDelivery > windowStart) {
      return oldestDelivery + this.rateLimitConfig.windowMs - Date.now();
    }

    return 0;
  }

  /**
   * Enqueue activity delivery
   *
   * Adds delivery job to queue (if available) or delivers synchronously.
   * Supports priority levels and deduplication by inbox URL.
   * Implements per-server rate limiting with automatic backpressure handling.
   *
   * @param data - Delivery job data
   * @returns Promise that resolves when job is enqueued or delivered
   *
   * @example
   * ```typescript
   * await queue.enqueue({
   *   activity: { type: 'Follow', actor: '...', object: '...' },
   *   inboxUrl: 'https://remote.example/inbox',
   *   keyId: 'https://local.example/users/alice#main-key',
   *   privateKey: '-----BEGIN PRIVATE KEY-----...',
   *   priority: JobPriority.URGENT,
   * });
   * ```
   */
  public async enqueue(data: DeliveryJobData): Promise<void> {
    const priority = data.priority ?? JobPriority.NORMAL;
    const hostname = this.extractHostname(data.inboxUrl);

    // Check rate limit
    const rateLimitOk = this.checkRateLimit(hostname);

    if (this.useQueue && this.queue) {
      let delay = 0;

      // If rate limit exceeded, calculate backpressure delay
      if (!rateLimitOk) {
        delay = this.calculateRateLimitDelay(hostname);

        // Cap delay at 60 seconds (backpressure limit)
        if (delay > 60000) {
          logger.warn({ hostname }, "Rate limit backpressure too high, dropping delivery");
          return; // Drop the job if backpressure is too high
        }

        logger.debug({ hostname, delayMs: delay }, "Rate limit reached, delaying delivery");
      }

      try {
        // Add to queue with retry options, priority, and optional delay
        await this.queue.add("deliver", data, {
          priority, // Lower number = higher priority
          attempts: 5, // Retry up to 5 times
          backoff: {
            type: "exponential",
            delay: 1000, // Start with 1 second delay
          },
          delay, // Apply rate limit delay if needed
          removeOnComplete: true, // Clean up completed jobs
          removeOnFail: {
            age: 24 * 3600, // Keep failed jobs for 24 hours
          },
          // Deduplication: if same activity to same inbox within 5 seconds, skip
          jobId: this.generateJobId(data),
        });

        logger.debug({ inboxUrl: data.inboxUrl, priority, delayMs: delay }, "Queued delivery");
      } catch (error) {
        // Queue operation failed (e.g., Dragonfly cluster mode issue)
        // Fall back to synchronous delivery
        logger.debug({ err: error }, "Queue operation failed, falling back to sync delivery");
        await this.deliverSync(data);
      }
    } else {
      // Fallback to synchronous delivery
      // In sync mode, apply rate limit via sleep
      if (!rateLimitOk) {
        const delay = this.calculateRateLimitDelay(hostname);
        if (delay > 0 && delay <= 60000) {
          logger.debug({ hostname, delayMs: delay }, "Rate limit reached, waiting");
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }

      logger.debug({ inboxUrl: data.inboxUrl }, "Synchronous delivery");
      await this.deliverSync(data);
    }
  }

  /**
   * Generate unique job ID for deduplication
   *
   * Creates a job ID based on activity ID and inbox URL to prevent
   * duplicate deliveries within a short time window.
   * Uses a simple numeric hash to avoid special characters that may
   * cause issues with Dragonfly's Lua scripts.
   *
   * @param data - Delivery job data
   * @returns Job ID for deduplication
   *
   * @private
   */
  private generateJobId(data: DeliveryJobData): string {
    const activityId = data.activity.id || JSON.stringify(data.activity);
    // Use a simple hash that avoids special characters
    // Create a numeric hash from the string for cluster-safe job ID
    const input = `${activityId}-${data.inboxUrl}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `${Math.abs(hash).toString(36)}`;
  }

  /**
   * Process delivery job
   *
   * Called by BullMQ worker to process queued jobs.
   *
   * @param job - BullMQ job
   * @private
   */
  private async processJob(job: Job<DeliveryJobData>): Promise<void> {
    const { activity, inboxUrl, keyId, privateKey } = job.data;

    logger.debug({ inboxUrl, attempt: job.attemptsMade + 1 }, "Processing delivery");

    try {
      await this.deliveryService.deliver(activity, inboxUrl, keyId, privateKey);

      logger.debug({ inboxUrl }, "Delivered successfully");

      // Record success metric
      this.recordMetric(inboxUrl, "success");
    } catch (error) {
      // Record failure metric
      this.recordMetric(inboxUrl, "failure");
      throw error; // Re-throw for BullMQ retry logic
    }
  }

  /**
   * Record delivery metrics
   *
   * Tracks success/failure counts per inbox URL.
   *
   * @param inboxUrl - Target inbox URL
   * @param type - Metric type (success or failure)
   *
   * @private
   */
  private recordMetric(inboxUrl: string, type: "success" | "failure"): void {
    const metrics = this.deliveryMetrics.get(inboxUrl) || { success: 0, failure: 0 };

    if (type === "success") {
      metrics.success++;
    } else {
      metrics.failure++;
    }

    this.deliveryMetrics.set(inboxUrl, metrics);
  }

  /**
   * Get delivery metrics
   *
   * Returns current delivery statistics for all inboxes.
   *
   * @returns Map of inbox URLs to success/failure counts
   */
  public getMetrics(): Map<string, { success: number; failure: number }> {
    return new Map(this.deliveryMetrics);
  }

  /**
   * Get metrics for a specific inbox
   *
   * @param inboxUrl - Target inbox URL
   * @returns Success/failure counts or null if no data
   */
  public getMetricsForInbox(inboxUrl: string): { success: number; failure: number } | null {
    return this.deliveryMetrics.get(inboxUrl) || null;
  }

  /**
   * Get delivery statistics summary
   *
   * Calculates overall success rate and per-server statistics.
   *
   * @returns Delivery statistics summary
   *
   * @example
   * ```typescript
   * const stats = queue.getDeliveryStatistics();
   * console.log(`Success rate: ${stats.successRate}%`);
   * ```
   */
  public getDeliveryStatistics(): {
    totalDeliveries: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    successRate: number;
    serverCount: number;
    topServers: Array<{ inbox: string; success: number; failure: number; successRate: number }>;
  } {
    let totalSuccess = 0;
    let totalFailure = 0;

    // Calculate totals
    for (const metrics of this.deliveryMetrics.values()) {
      totalSuccess += metrics.success;
      totalFailure += metrics.failure;
    }

    const totalDeliveries = totalSuccess + totalFailure;
    const successRate =
      totalDeliveries > 0 ? Math.round((totalSuccess / totalDeliveries) * 100 * 100) / 100 : 0;

    // Get top servers by delivery count
    const serverStats = Array.from(this.deliveryMetrics.entries())
      .map(([inbox, metrics]) => ({
        inbox,
        success: metrics.success,
        failure: metrics.failure,
        successRate:
          metrics.success + metrics.failure > 0
            ? Math.round((metrics.success / (metrics.success + metrics.failure)) * 100 * 100) / 100
            : 0,
      }))
      .sort((a, b) => b.success + b.failure - (a.success + a.failure))
      .slice(0, 10); // Top 10 servers

    return {
      totalDeliveries,
      successfulDeliveries: totalSuccess,
      failedDeliveries: totalFailure,
      successRate,
      serverCount: this.deliveryMetrics.size,
      topServers: serverStats,
    };
  }

  /**
   * Log delivery statistics to console
   *
   * Outputs a formatted summary of delivery statistics.
   */
  public logDeliveryStatistics(): void {
    const stats = this.getDeliveryStatistics();

    logger.info(
      {
        totalDeliveries: stats.totalDeliveries,
        successfulDeliveries: stats.successfulDeliveries,
        failedDeliveries: stats.failedDeliveries,
        successRate: stats.successRate,
        serverCount: stats.serverCount,
        topServers: stats.topServers.map((s) => ({
          hostname: this.extractHostname(s.inbox),
          success: s.success,
          failure: s.failure,
          successRate: s.successRate,
        })),
      },
      "ActivityPub Delivery Statistics",
    );
  }

  /**
   * Start periodic statistics logging
   *
   * Logs delivery statistics every hour (configurable via STATS_LOG_INTERVAL_MS env var).
   *
   * @private
   */
  private startPeriodicStatsLogging(): void {
    const intervalMs = parseInt(process.env.STATS_LOG_INTERVAL_MS || "3600000", 10); // Default: 1 hour

    this.statsInterval = setInterval(() => {
      const stats = this.getDeliveryStatistics();

      // Only log if there have been any deliveries
      if (stats.totalDeliveries > 0) {
        this.logDeliveryStatistics();

        // Warn if success rate is below 95%
        if (stats.successRate < 95) {
          logger.warn({ successRate: stats.successRate }, "Delivery success rate is below target (95%)");
        }
      }
    }, intervalMs);

    logger.debug({ intervalMs }, "Periodic statistics logging started");
  }

  /**
   * Stop periodic statistics logging
   *
   * @private
   */
  private stopPeriodicStatsLogging(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
      logger.info("Periodic statistics logging stopped");
    }
  }

  /**
   * Deliver activity synchronously
   *
   * Fallback method when queue is not available.
   *
   * @param data - Delivery job data
   * @private
   */
  private async deliverSync(data: DeliveryJobData): Promise<void> {
    try {
      await this.deliveryService.deliver(data.activity, data.inboxUrl, data.keyId, data.privateKey);
      logger.debug({ inboxUrl: data.inboxUrl }, "Delivered successfully");
      // Record success metric for sync delivery
      this.recordMetric(data.inboxUrl, "success");
    } catch (error) {
      logger.error({ err: error, inboxUrl: data.inboxUrl }, "Failed to deliver");
      // Record failure metric for sync delivery
      this.recordMetric(data.inboxUrl, "failure");
      // In sync mode, we don't retry - just log the error
    }
  }

  /**
   * Gracefully shutdown queue and worker
   *
   * Should be called when application is shutting down.
   * Logs final statistics before shutting down.
   *
   * @example
   * ```typescript
   * process.on('SIGTERM', async () => {
   *   await queue.shutdown();
   *   process.exit(0);
   * });
   * ```
   */
  public async shutdown(): Promise<void> {
    logger.info("Shutting down ActivityDeliveryQueue...");

    // Stop periodic statistics logging
    this.stopPeriodicStatsLogging();

    // Log final statistics
    const stats = this.getDeliveryStatistics();
    if (stats.totalDeliveries > 0) {
      logger.info("Final Delivery Statistics:");
      this.logDeliveryStatistics();
    }

    if (this.worker) {
      await this.worker.close();
    }

    if (this.queue) {
      await this.queue.close();
    }

    if (this.redis) {
      await this.redis.quit();
    }

    logger.info("ActivityDeliveryQueue shut down");
  }
}
