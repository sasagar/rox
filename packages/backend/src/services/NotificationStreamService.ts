/**
 * Notification Stream Service
 *
 * Provides Server-Sent Events (SSE) for real-time notification delivery.
 * Uses an event emitter pattern to broadcast notifications to connected clients.
 *
 * @module services/NotificationStreamService
 */

import { EventEmitter } from "events";

/**
 * Notification event payload
 */
export interface NotificationEvent {
  /** Event type */
  type: "notification" | "unreadCount";
  /** Notification data */
  data: unknown;
}

/**
 * Connection metrics for monitoring
 */
export interface ConnectionMetrics {
  /** Total number of active connections */
  totalConnections: number;
  /** Number of unique users connected */
  uniqueUsers: number;
  /** Total notifications sent since service start */
  totalNotificationsSent: number;
  /** Total unread count updates sent since service start */
  totalUnreadCountsSent: number;
  /** Peak concurrent connections reached */
  peakConnections: number;
  /** Service uptime in milliseconds */
  uptimeMs: number;
  /** Memory usage in bytes */
  memoryUsageBytes: number;
}

/**
 * Notification Stream Service
 *
 * Singleton service that manages SSE connections for real-time notifications.
 * Uses Node.js EventEmitter to broadcast notifications to subscribed clients.
 *
 * @remarks
 * - Each user has their own event channel (keyed by user ID)
 * - Clients subscribe via SSE endpoint
 * - Notifications are pushed immediately when created
 */
export class NotificationStreamService {
  private static instance: NotificationStreamService;
  private emitter: EventEmitter;

  // Metrics tracking
  private connectedUsers: Map<string, number> = new Map(); // userId -> connection count
  private totalNotificationsSent = 0;
  private totalUnreadCountsSent = 0;
  private peakConnections = 0;
  private serviceStartTime: number;

  private constructor() {
    this.emitter = new EventEmitter();
    // Increase max listeners to handle many concurrent connections
    this.emitter.setMaxListeners(10000);
    this.serviceStartTime = Date.now();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): NotificationStreamService {
    if (!NotificationStreamService.instance) {
      NotificationStreamService.instance = new NotificationStreamService();
    }
    return NotificationStreamService.instance;
  }

  /**
   * Subscribe to notifications for a user
   *
   * @param userId - User ID to subscribe to
   * @param callback - Callback to receive notifications
   * @returns Unsubscribe function
   */
  subscribe(userId: string, callback: (event: NotificationEvent) => void): () => void {
    const channel = `user:${userId}`;
    this.emitter.on(channel, callback);

    // Track connection
    const currentCount = this.connectedUsers.get(userId) || 0;
    this.connectedUsers.set(userId, currentCount + 1);
    this.updatePeakConnections();

    return () => {
      this.emitter.off(channel, callback);
      // Update connection tracking
      const count = this.connectedUsers.get(userId) || 1;
      if (count <= 1) {
        this.connectedUsers.delete(userId);
      } else {
        this.connectedUsers.set(userId, count - 1);
      }
    };
  }

  /**
   * Push a notification to a user
   *
   * @param userId - User ID to notify
   * @param notification - Notification data
   */
  pushNotification(userId: string, notification: unknown): void {
    const channel = `user:${userId}`;
    const event: NotificationEvent = {
      type: "notification",
      data: notification,
    };
    this.emitter.emit(channel, event);
    this.totalNotificationsSent++;
  }

  /**
   * Push unread count update to a user
   *
   * @param userId - User ID to notify
   * @param count - Unread count
   */
  pushUnreadCount(userId: string, count: number): void {
    const channel = `user:${userId}`;
    const event: NotificationEvent = {
      type: "unreadCount",
      data: { count },
    };
    this.emitter.emit(channel, event);
    this.totalUnreadCountsSent++;
  }

  /**
   * Get the number of listeners for a user
   *
   * @param userId - User ID
   * @returns Number of active listeners
   */
  getListenerCount(userId: string): number {
    const channel = `user:${userId}`;
    return this.emitter.listenerCount(channel);
  }

  /**
   * Get total number of active connections
   */
  getTotalConnections(): number {
    let total = 0;
    for (const count of this.connectedUsers.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Update peak connections if current is higher
   */
  private updatePeakConnections(): void {
    const current = this.getTotalConnections();
    if (current > this.peakConnections) {
      this.peakConnections = current;
    }
  }

  /**
   * Get connection metrics for monitoring
   *
   * @returns Current connection metrics
   */
  getMetrics(): ConnectionMetrics {
    const memUsage = process.memoryUsage();
    return {
      totalConnections: this.getTotalConnections(),
      uniqueUsers: this.connectedUsers.size,
      totalNotificationsSent: this.totalNotificationsSent,
      totalUnreadCountsSent: this.totalUnreadCountsSent,
      peakConnections: this.peakConnections,
      uptimeMs: Date.now() - this.serviceStartTime,
      memoryUsageBytes: memUsage.heapUsed,
    };
  }

  /**
   * Get list of connected user IDs with their connection counts
   *
   * @returns Map of userId to connection count
   */
  getConnectedUsers(): Map<string, number> {
    return new Map(this.connectedUsers);
  }

  /**
   * Check if the service is healthy
   *
   * @returns true if the service is operational
   */
  isHealthy(): boolean {
    // Service is healthy if:
    // 1. EventEmitter is functional
    // 2. Memory usage is below threshold (1GB)
    const memUsage = process.memoryUsage();
    const memoryThreshold = 1024 * 1024 * 1024; // 1GB
    return memUsage.heapUsed < memoryThreshold;
  }
}

// Export singleton getter
export function getNotificationStreamService(): NotificationStreamService {
  return NotificationStreamService.getInstance();
}
