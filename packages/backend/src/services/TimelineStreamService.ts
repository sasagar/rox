/**
 * Timeline Stream Service
 *
 * Provides Server-Sent Events (SSE) for real-time timeline updates.
 * Uses an event emitter pattern to broadcast new notes to connected clients.
 *
 * Supports multiple timeline channels:
 * - home: Notes from followed users (per-user channel)
 * - local: All local public notes (global channel)
 * - social: Local + followed users' public notes (per-user channel)
 *
 * @module services/TimelineStreamService
 */

import { EventEmitter } from "events";

/**
 * Timeline event types
 */
export type TimelineEventType = "note" | "noteDeleted" | "noteUpdated" | "noteReacted";

/**
 * Timeline channel types
 */
export type TimelineChannel = "home" | "local" | "social" | "list";

/**
 * Timeline event payload
 */
export interface TimelineEvent {
  /** Event type */
  type: TimelineEventType;
  /** Note data or note ID (for delete events) */
  data: unknown;
}

/**
 * Connection metrics for monitoring
 */
export interface TimelineConnectionMetrics {
  /** Total number of active connections */
  totalConnections: number;
  /** Number of unique users connected to home timeline */
  uniqueHomeUsers: number;
  /** Number of connections to local timeline */
  localTimelineConnections: number;
  /** Number of unique users connected to social timeline */
  uniqueSocialUsers: number;
  /** Number of list timeline subscriptions */
  listTimelineConnections: number;
  /** Total notes pushed since service start */
  totalNotesPushed: number;
  /** Peak concurrent connections reached */
  peakConnections: number;
  /** Service uptime in milliseconds */
  uptimeMs: number;
  /** Memory usage in bytes */
  memoryUsageBytes: number;
}

/**
 * Timeline Stream Service
 *
 * Singleton service that manages SSE connections for real-time timeline updates.
 * Uses Node.js EventEmitter to broadcast notes to subscribed clients.
 *
 * Channel naming:
 * - `home:{userId}` - Home timeline for specific user
 * - `local` - Local public timeline (global)
 * - `social:{userId}` - Social timeline for specific user
 */
export class TimelineStreamService {
  private static instance: TimelineStreamService;
  private emitter: EventEmitter;

  // Connection tracking
  private homeUsers: Map<string, number> = new Map(); // userId -> connection count
  private localConnections = 0;
  private socialUsers: Map<string, number> = new Map(); // userId -> connection count
  private listConnections: Map<string, number> = new Map(); // listId -> connection count

  // Metrics
  private totalNotesPushed = 0;
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
  static getInstance(): TimelineStreamService {
    if (!TimelineStreamService.instance) {
      TimelineStreamService.instance = new TimelineStreamService();
    }
    return TimelineStreamService.instance;
  }

  /**
   * Subscribe to home timeline for a user
   *
   * @param userId - User ID to subscribe to
   * @param callback - Callback to receive timeline events
   * @returns Unsubscribe function
   */
  subscribeHome(userId: string, callback: (event: TimelineEvent) => void): () => void {
    const channel = `home:${userId}`;
    this.emitter.on(channel, callback);

    // Track connection
    const currentCount = this.homeUsers.get(userId) || 0;
    this.homeUsers.set(userId, currentCount + 1);
    this.updatePeakConnections();

    return () => {
      this.emitter.off(channel, callback);
      const count = this.homeUsers.get(userId) || 1;
      if (count <= 1) {
        this.homeUsers.delete(userId);
      } else {
        this.homeUsers.set(userId, count - 1);
      }
    };
  }

  /**
   * Subscribe to local timeline
   *
   * @param callback - Callback to receive timeline events
   * @returns Unsubscribe function
   */
  subscribeLocal(callback: (event: TimelineEvent) => void): () => void {
    const channel = "local";
    this.emitter.on(channel, callback);

    this.localConnections++;
    this.updatePeakConnections();

    return () => {
      this.emitter.off(channel, callback);
      this.localConnections = Math.max(0, this.localConnections - 1);
    };
  }

  /**
   * Subscribe to social timeline for a user
   *
   * @param userId - User ID to subscribe to
   * @param callback - Callback to receive timeline events
   * @returns Unsubscribe function
   */
  subscribeSocial(userId: string, callback: (event: TimelineEvent) => void): () => void {
    const channel = `social:${userId}`;
    this.emitter.on(channel, callback);

    // Track connection
    const currentCount = this.socialUsers.get(userId) || 0;
    this.socialUsers.set(userId, currentCount + 1);
    this.updatePeakConnections();

    return () => {
      this.emitter.off(channel, callback);
      const count = this.socialUsers.get(userId) || 1;
      if (count <= 1) {
        this.socialUsers.delete(userId);
      } else {
        this.socialUsers.set(userId, count - 1);
      }
    };
  }

  /**
   * Subscribe to list timeline
   *
   * @param listId - List ID to subscribe to
   * @param callback - Callback to receive timeline events
   * @returns Unsubscribe function
   */
  subscribeList(listId: string, callback: (event: TimelineEvent) => void): () => void {
    const channel = `list:${listId}`;
    this.emitter.on(channel, callback);

    // Track connection
    const currentCount = this.listConnections.get(listId) || 0;
    this.listConnections.set(listId, currentCount + 1);
    this.updatePeakConnections();

    return () => {
      this.emitter.off(channel, callback);
      const count = this.listConnections.get(listId) || 1;
      if (count <= 1) {
        this.listConnections.delete(listId);
      } else {
        this.listConnections.set(listId, count - 1);
      }
    };
  }

  /**
   * Push a new note to home timelines of followers
   *
   * @param followerIds - Array of follower user IDs
   * @param note - Note data to push
   */
  pushToHomeTimelines(followerIds: string[], note: unknown): void {
    const event: TimelineEvent = {
      type: "note",
      data: note,
    };

    for (const followerId of followerIds) {
      const channel = `home:${followerId}`;
      if (this.emitter.listenerCount(channel) > 0) {
        this.emitter.emit(channel, event);
        this.totalNotesPushed++;
      }
    }
  }

  /**
   * Push a new note to local timeline
   *
   * @param note - Note data to push
   */
  pushToLocalTimeline(note: unknown): void {
    const event: TimelineEvent = {
      type: "note",
      data: note,
    };
    this.emitter.emit("local", event);
    this.totalNotesPushed++;
  }

  /**
   * Push a new note to social timelines
   *
   * @param followerIds - Array of follower user IDs (note author's followers)
   * @param note - Note data to push
   */
  pushToSocialTimelines(followerIds: string[], note: unknown): void {
    const event: TimelineEvent = {
      type: "note",
      data: note,
    };

    for (const followerId of followerIds) {
      const channel = `social:${followerId}`;
      if (this.emitter.listenerCount(channel) > 0) {
        this.emitter.emit(channel, event);
        this.totalNotesPushed++;
      }
    }
  }

  /**
   * Push a new note to list timelines
   *
   * Called when a note is created by a user who is in one or more lists.
   *
   * @param listIds - Array of list IDs that contain the note author
   * @param note - Note data to push
   */
  pushToListTimelines(listIds: string[], note: unknown): void {
    const event: TimelineEvent = {
      type: "note",
      data: note,
    };

    for (const listId of listIds) {
      const channel = `list:${listId}`;
      if (this.emitter.listenerCount(channel) > 0) {
        this.emitter.emit(channel, event);
        this.totalNotesPushed++;
      }
    }
  }

  /**
   * Push note deletion event
   *
   * @param noteId - ID of deleted note
   * @param affectedUserIds - User IDs who might have this note in their timeline
   */
  pushNoteDeleted(noteId: string, affectedUserIds: string[]): void {
    const event: TimelineEvent = {
      type: "noteDeleted",
      data: { noteId },
    };

    // Push to local timeline
    this.emitter.emit("local", event);

    // Push to home/social timelines of affected users
    for (const userId of affectedUserIds) {
      this.emitter.emit(`home:${userId}`, event);
      this.emitter.emit(`social:${userId}`, event);
    }
  }

  /**
   * Push note reaction event
   *
   * Notifies connected clients that a note's reactions have changed.
   * This allows real-time updates of reaction counts without polling.
   *
   * @param noteId - ID of the note that was reacted to
   * @param noteAuthorId - User ID of the note author (for home/social timelines)
   * @param reaction - The reaction emoji that was added/removed
   * @param action - Whether the reaction was added or removed
   * @param counts - Updated reaction counts for the note
   * @param emojis - Custom emoji URLs (if any)
   */
  pushNoteReacted(
    noteId: string,
    noteAuthorId: string | null,
    reaction: string,
    action: "add" | "remove",
    counts: Record<string, number>,
    emojis: Record<string, string>,
  ): void {
    const event: TimelineEvent = {
      type: "noteReacted",
      data: { noteId, reaction, action, counts, emojis },
    };

    // Push to local timeline (all local notes)
    this.emitter.emit("local", event);

    // Push to home/social timelines of note author's followers
    if (noteAuthorId) {
      // Note author sees their own note's reactions in their timeline
      this.emitter.emit(`home:${noteAuthorId}`, event);
      this.emitter.emit(`social:${noteAuthorId}`, event);
    }

    // Also broadcast to all connected users (they may have the note in their timeline)
    for (const userId of this.homeUsers.keys()) {
      if (userId !== noteAuthorId) {
        this.emitter.emit(`home:${userId}`, event);
      }
    }
    for (const userId of this.socialUsers.keys()) {
      if (userId !== noteAuthorId) {
        this.emitter.emit(`social:${userId}`, event);
      }
    }
  }

  /**
   * Get total number of active connections
   */
  getTotalConnections(): number {
    let total = this.localConnections;
    for (const count of this.homeUsers.values()) {
      total += count;
    }
    for (const count of this.socialUsers.values()) {
      total += count;
    }
    for (const count of this.listConnections.values()) {
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
  getMetrics(): TimelineConnectionMetrics {
    const memUsage = process.memoryUsage();
    let listConnectionCount = 0;
    for (const count of this.listConnections.values()) {
      listConnectionCount += count;
    }
    return {
      totalConnections: this.getTotalConnections(),
      uniqueHomeUsers: this.homeUsers.size,
      localTimelineConnections: this.localConnections,
      uniqueSocialUsers: this.socialUsers.size,
      listTimelineConnections: listConnectionCount,
      totalNotesPushed: this.totalNotesPushed,
      peakConnections: this.peakConnections,
      uptimeMs: Date.now() - this.serviceStartTime,
      memoryUsageBytes: memUsage.heapUsed,
    };
  }

  /**
   * Check if the service is healthy
   *
   * @returns true if the service is operational
   */
  isHealthy(): boolean {
    const memUsage = process.memoryUsage();
    const memoryThreshold = 1024 * 1024 * 1024; // 1GB
    return memUsage.heapUsed < memoryThreshold;
  }
}

/**
 * Get singleton instance
 */
export function getTimelineStreamService(): TimelineStreamService {
  return TimelineStreamService.getInstance();
}
