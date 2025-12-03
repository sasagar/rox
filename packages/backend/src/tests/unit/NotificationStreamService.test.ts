/**
 * NotificationStreamService Unit Tests
 *
 * Tests for the notification stream service including:
 * - Event emission and subscription
 * - Connection metrics tracking
 * - Health check functionality
 *
 * @module tests/unit/NotificationStreamService.test
 */

import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import {
  NotificationStreamService,
  getNotificationStreamService,
  type NotificationEvent,
} from "../../services/NotificationStreamService.js";

describe("NotificationStreamService", () => {
  let service: NotificationStreamService;

  beforeEach(() => {
    // Get singleton instance (can't create new instance due to private constructor)
    service = getNotificationStreamService();
  });

  afterEach(() => {
    // Clean up: Unsubscribe all test listeners
    // Since we're using singleton, we need to be careful
  });

  describe("subscribe", () => {
    it("should allow subscribing to user events", () => {
      const userId = "test-user-1";
      const events: NotificationEvent[] = [];

      const unsubscribe = service.subscribe(userId, (event) => {
        events.push(event);
      });

      expect(service.getListenerCount(userId)).toBe(1);

      // Cleanup
      unsubscribe();
      expect(service.getListenerCount(userId)).toBe(0);
    });

    it("should support multiple subscriptions for same user", () => {
      const userId = "test-user-2";
      const events1: NotificationEvent[] = [];
      const events2: NotificationEvent[] = [];

      const unsubscribe1 = service.subscribe(userId, (event) => {
        events1.push(event);
      });
      const unsubscribe2 = service.subscribe(userId, (event) => {
        events2.push(event);
      });

      expect(service.getListenerCount(userId)).toBe(2);

      // Send a notification
      service.pushNotification(userId, { message: "test" });

      expect(events1.length).toBe(1);
      expect(events2.length).toBe(1);

      // Cleanup
      unsubscribe1();
      unsubscribe2();
    });
  });

  describe("pushNotification", () => {
    it("should emit notification event to subscribers", () => {
      const userId = "test-user-3";
      const receivedEvents: NotificationEvent[] = [];

      const unsubscribe = service.subscribe(userId, (event) => {
        receivedEvents.push(event);
      });

      const testData = { id: "123", message: "Hello" };
      service.pushNotification(userId, testData);

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0]?.type).toBe("notification");
      expect(receivedEvents[0]?.data).toEqual(testData);

      unsubscribe();
    });
  });

  describe("pushUnreadCount", () => {
    it("should emit unreadCount event to subscribers", () => {
      const userId = "test-user-4";
      const receivedEvents: NotificationEvent[] = [];

      const unsubscribe = service.subscribe(userId, (event) => {
        receivedEvents.push(event);
      });

      service.pushUnreadCount(userId, 5);

      expect(receivedEvents.length).toBe(1);
      expect(receivedEvents[0]?.type).toBe("unreadCount");
      expect(receivedEvents[0]?.data).toEqual({ count: 5 });

      unsubscribe();
    });
  });

  describe("getMetrics", () => {
    it("should return connection metrics", () => {
      const metrics = service.getMetrics();

      expect(metrics).toHaveProperty("totalConnections");
      expect(metrics).toHaveProperty("uniqueUsers");
      expect(metrics).toHaveProperty("totalNotificationsSent");
      expect(metrics).toHaveProperty("totalUnreadCountsSent");
      expect(metrics).toHaveProperty("peakConnections");
      expect(metrics).toHaveProperty("uptimeMs");
      expect(metrics).toHaveProperty("memoryUsageBytes");

      expect(typeof metrics.totalConnections).toBe("number");
      expect(typeof metrics.uniqueUsers).toBe("number");
      expect(typeof metrics.memoryUsageBytes).toBe("number");
    });

    it("should track total connections correctly", () => {
      const userId = "test-user-metrics-1";

      const metricsBefore = service.getMetrics();
      const connectionsBefore = metricsBefore.totalConnections;

      const unsubscribe = service.subscribe(userId, () => {});
      const metricsAfter = service.getMetrics();

      expect(metricsAfter.totalConnections).toBe(connectionsBefore + 1);
      expect(metricsAfter.uniqueUsers).toBeGreaterThanOrEqual(1);

      unsubscribe();

      const metricsCleanup = service.getMetrics();
      expect(metricsCleanup.totalConnections).toBe(connectionsBefore);
    });

    it("should track notifications sent", () => {
      const userId = "test-user-metrics-2";
      const unsubscribe = service.subscribe(userId, () => {});

      const metricsBefore = service.getMetrics();
      const notificationsBefore = metricsBefore.totalNotificationsSent;

      service.pushNotification(userId, { test: true });

      const metricsAfter = service.getMetrics();
      expect(metricsAfter.totalNotificationsSent).toBe(notificationsBefore + 1);

      unsubscribe();
    });

    it("should track unread count updates sent", () => {
      const userId = "test-user-metrics-3";
      const unsubscribe = service.subscribe(userId, () => {});

      const metricsBefore = service.getMetrics();
      const unreadCountsBefore = metricsBefore.totalUnreadCountsSent;

      service.pushUnreadCount(userId, 10);

      const metricsAfter = service.getMetrics();
      expect(metricsAfter.totalUnreadCountsSent).toBe(unreadCountsBefore + 1);

      unsubscribe();
    });
  });

  describe("getTotalConnections", () => {
    it("should return total number of active connections", () => {
      const userId1 = "test-user-conn-1";
      const userId2 = "test-user-conn-2";

      const connectionsBefore = service.getTotalConnections();

      const unsub1 = service.subscribe(userId1, () => {});
      const unsub2 = service.subscribe(userId1, () => {}); // Same user, 2nd connection
      const unsub3 = service.subscribe(userId2, () => {});

      expect(service.getTotalConnections()).toBe(connectionsBefore + 3);

      unsub1();
      unsub2();
      unsub3();

      expect(service.getTotalConnections()).toBe(connectionsBefore);
    });
  });

  describe("getConnectedUsers", () => {
    it("should return map of connected users with connection counts", () => {
      const userId = "test-user-map-1";

      const unsub1 = service.subscribe(userId, () => {});
      const unsub2 = service.subscribe(userId, () => {});

      const connectedUsers = service.getConnectedUsers();
      expect(connectedUsers.get(userId)).toBe(2);

      unsub1();
      unsub2();
    });
  });

  describe("isHealthy", () => {
    it("should return true when service is operating normally", () => {
      expect(service.isHealthy()).toBe(true);
    });
  });

  describe("singleton", () => {
    it("should return the same instance", () => {
      const instance1 = getNotificationStreamService();
      const instance2 = getNotificationStreamService();

      expect(instance1).toBe(instance2);
    });
  });
});
