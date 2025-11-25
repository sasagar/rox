/**
 * ActivityPub Activity Delivery Queue
 *
 * Manages asynchronous delivery of ActivityPub activities to remote servers.
 * Uses BullMQ when Redis is available, falls back to sync delivery otherwise.
 *
 * @module services/ap/ActivityDeliveryQueue
 */

import { Queue, Worker, type Job } from 'bullmq';
import { Redis } from 'ioredis';
import { ActivityDeliveryService } from './ActivityDeliveryService.js';

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

  /**
   * Constructor
   *
   * Creates a new ActivityDeliveryQueue instance and initializes Redis connection.
   */
  constructor() {
    this.deliveryService = new ActivityDeliveryService();
    this.initPromise = this.initializeQueue();
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
   * Initialize BullMQ queue and worker
   *
   * Attempts to connect to Redis. If connection fails, falls back to sync mode.
   *
   * @private
   */
  private async initializeQueue(): Promise<void> {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

    try {
      // Attempt to connect to Redis
      this.redis = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null; // Give up after 3 attempts
          return Math.min(times * 100, 1000); // Exponential backoff up to 1 second
        },
        connectTimeout: 5000,
        enableOfflineQueue: false, // Fail fast if connection is not ready
      });

      // Wait for connection to be ready
      await new Promise<void>((resolve, reject) => {
        this.redis!.once('ready', () => resolve());
        this.redis!.once('error', (err) => reject(err));
      });

      console.log('✅ Redis connected, using BullMQ for delivery queue');

      // Initialize queue
      this.queue = new Queue<DeliveryJobData>('activitypub-delivery', {
        connection: this.redis,
      });

      // Initialize worker
      this.worker = new Worker<DeliveryJobData>(
        'activitypub-delivery',
        async (job: Job<DeliveryJobData>) => {
          await this.processJob(job);
        },
        {
          connection: this.redis,
          concurrency: 10, // Process up to 10 jobs concurrently
        }
      );

      this.worker.on('failed', (job, err) => {
        console.error(`Job ${job?.id} failed:`, err);
      });

      this.useQueue = true;
    } catch (error) {
      console.warn('⚠️  Redis not available, using synchronous delivery fallback');
      console.warn(`   Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      this.useQueue = false;

      // Clean up failed connection
      if (this.redis) {
        this.redis.disconnect();
        this.redis = null;
      }
    }
  }

  /**
   * Enqueue activity delivery
   *
   * Adds delivery job to queue (if available) or delivers synchronously.
   *
   * @param data - Delivery job data
   * @returns Promise that resolves when job is enqueued or delivered
   *
   * @example
   * ```typescript
   * await queue.enqueue({
   *   activity: { type: 'Like', actor: '...', object: '...' },
   *   inboxUrl: 'https://remote.example/inbox',
   *   keyId: 'https://local.example/users/alice#main-key',
   *   privateKey: '-----BEGIN PRIVATE KEY-----...',
   * });
   * ```
   */
  public async enqueue(data: DeliveryJobData): Promise<void> {
    if (this.useQueue && this.queue) {
      // Add to queue with retry options
      await this.queue.add('deliver', data, {
        attempts: 5, // Retry up to 5 times
        backoff: {
          type: 'exponential',
          delay: 1000, // Start with 1 second delay
        },
        removeOnComplete: true, // Clean up completed jobs
        removeOnFail: {
          age: 24 * 3600, // Keep failed jobs for 24 hours
        },
      });

      console.log(`📤 Queued delivery to ${data.inboxUrl}`);
    } else {
      // Fallback to synchronous delivery
      console.log(`📤 Synchronous delivery to ${data.inboxUrl}`);
      await this.deliverSync(data);
    }
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

    console.log(`📤 Processing delivery to ${inboxUrl} (attempt ${job.attemptsMade + 1})`);

    await this.deliveryService.deliver(activity, inboxUrl, keyId, privateKey);

    console.log(`✅ Delivered to ${inboxUrl}`);
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
      await this.deliveryService.deliver(
        data.activity,
        data.inboxUrl,
        data.keyId,
        data.privateKey
      );
      console.log(`✅ Delivered to ${data.inboxUrl}`);
    } catch (error) {
      console.error(`❌ Failed to deliver to ${data.inboxUrl}:`, error);
      // In sync mode, we don't retry - just log the error
    }
  }

  /**
   * Gracefully shutdown queue and worker
   *
   * Should be called when application is shutting down.
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
    console.log('Shutting down ActivityDeliveryQueue...');

    if (this.worker) {
      await this.worker.close();
    }

    if (this.queue) {
      await this.queue.close();
    }

    if (this.redis) {
      await this.redis.quit();
    }

    console.log('ActivityDeliveryQueue shut down');
  }
}
