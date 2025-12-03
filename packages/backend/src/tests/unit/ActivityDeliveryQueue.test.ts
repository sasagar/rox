/**
 * ActivityDeliveryQueue Unit Tests
 *
 * Tests the ActivityPub delivery queue service including:
 * - Queue initialization
 * - Job enqueue (sync mode)
 * - Rate limiting
 * - Metrics tracking
 * - Graceful shutdown
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  ActivityDeliveryQueue,
  JobPriority,
  type DeliveryJobData,
} from "../../services/ap/ActivityDeliveryQueue";

// Mock the ActivityDeliveryService
mock.module("../../services/ap/ActivityDeliveryService", () => ({
  ActivityDeliveryService: class {
    deliver = mock(() => Promise.resolve());
  },
}));

describe("ActivityDeliveryQueue", () => {
  let queue: ActivityDeliveryQueue;

  beforeEach(async () => {
    // Create queue without stats logging for tests
    queue = new ActivityDeliveryQueue(false);
    // Wait for initialization to complete
    await queue.waitForInit();
  });

  describe("JobPriority", () => {
    test("should define correct priority values", () => {
      expect(JobPriority.URGENT).toBe(1);
      expect(JobPriority.NORMAL).toBe(5);
      expect(JobPriority.LOW).toBe(10);
    });

    test("URGENT should have highest priority (lowest number)", () => {
      expect(JobPriority.URGENT).toBeLessThan(JobPriority.NORMAL);
      expect(JobPriority.NORMAL).toBeLessThan(JobPriority.LOW);
    });
  });

  describe("enqueue", () => {
    test("should accept delivery job data", async () => {
      const jobData: DeliveryJobData = {
        activity: {
          "@context": "https://www.w3.org/ns/activitystreams",
          type: "Follow",
          id: "https://local.example/activities/1",
          actor: "https://local.example/users/alice",
          object: "https://remote.example/users/bob",
        },
        inboxUrl: "https://remote.example/inbox",
        keyId: "https://local.example/users/alice#main-key",
        privateKey: "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----",
      };

      // Should not throw
      await expect(queue.enqueue(jobData)).resolves.toBeUndefined();
    });

    test("should accept job with priority", async () => {
      const jobData: DeliveryJobData = {
        activity: {
          type: "Follow",
          actor: "https://local.example/users/alice",
          object: "https://remote.example/users/bob",
        },
        inboxUrl: "https://remote.example/inbox",
        keyId: "https://local.example/users/alice#main-key",
        privateKey: "test-key",
        priority: JobPriority.URGENT,
      };

      await expect(queue.enqueue(jobData)).resolves.toBeUndefined();
    });

    test("should handle multiple enqueue calls", async () => {
      const baseJobData = {
        activity: { type: "Like", actor: "https://local.example/users/alice" },
        keyId: "https://local.example/users/alice#main-key",
        privateKey: "test-key",
      };

      const promises = [
        queue.enqueue({
          ...baseJobData,
          inboxUrl: "https://server1.example/inbox",
          activity: { ...baseJobData.activity, id: "1" },
        }),
        queue.enqueue({
          ...baseJobData,
          inboxUrl: "https://server2.example/inbox",
          activity: { ...baseJobData.activity, id: "2" },
        }),
        queue.enqueue({
          ...baseJobData,
          inboxUrl: "https://server3.example/inbox",
          activity: { ...baseJobData.activity, id: "3" },
        }),
      ];

      await expect(Promise.all(promises)).resolves.toBeDefined();
    });
  });

  describe("metrics", () => {
    test("should return empty metrics initially", () => {
      const metrics = queue.getMetrics();
      expect(metrics).toBeInstanceOf(Map);
      expect(metrics.size).toBe(0);
    });

    test("should return null for unknown inbox", () => {
      const metrics = queue.getMetricsForInbox("https://unknown.example/inbox");
      expect(metrics).toBeNull();
    });

    test("getDeliveryStatistics should return proper structure", () => {
      const stats = queue.getDeliveryStatistics();

      expect(stats).toHaveProperty("totalDeliveries");
      expect(stats).toHaveProperty("successfulDeliveries");
      expect(stats).toHaveProperty("failedDeliveries");
      expect(stats).toHaveProperty("successRate");
      expect(stats).toHaveProperty("serverCount");
      expect(stats).toHaveProperty("topServers");

      expect(typeof stats.totalDeliveries).toBe("number");
      expect(typeof stats.successfulDeliveries).toBe("number");
      expect(typeof stats.failedDeliveries).toBe("number");
      expect(typeof stats.successRate).toBe("number");
      expect(typeof stats.serverCount).toBe("number");
      expect(Array.isArray(stats.topServers)).toBe(true);
    });

    test("initial statistics should show zero deliveries", () => {
      const stats = queue.getDeliveryStatistics();

      expect(stats.totalDeliveries).toBe(0);
      expect(stats.successfulDeliveries).toBe(0);
      expect(stats.failedDeliveries).toBe(0);
      expect(stats.successRate).toBe(0);
      expect(stats.serverCount).toBe(0);
      expect(stats.topServers.length).toBe(0);
    });
  });

  describe("shutdown", () => {
    test("should shutdown gracefully", async () => {
      await expect(queue.shutdown()).resolves.toBeUndefined();
    });

    test("should be idempotent (can be called multiple times)", async () => {
      await queue.shutdown();
      await expect(queue.shutdown()).resolves.toBeUndefined();
    });
  });
});

describe("ActivityDeliveryQueue rate limiting", () => {
  test("should extract hostname from inbox URL", () => {
    const queue = new ActivityDeliveryQueue(false);

    // Access private method via type assertion for testing
    const extractHostname = (queue as any).extractHostname.bind(queue);

    expect(extractHostname("https://mastodon.social/inbox")).toBe("mastodon.social");
    expect(extractHostname("https://remote.example.com/users/alice/inbox")).toBe(
      "remote.example.com",
    );
    expect(extractHostname("https://server.example:8080/inbox")).toBe("server.example");
  });

  test("should allow deliveries under rate limit", () => {
    const queue = new ActivityDeliveryQueue(false);

    // Access private method via type assertion for testing
    const checkRateLimit = (queue as any).checkRateLimit.bind(queue);

    // First 10 deliveries should be allowed (default limit)
    for (let i = 0; i < 10; i++) {
      expect(checkRateLimit("test.example.com")).toBe(true);
    }
  });

  test("should block deliveries over rate limit", () => {
    const queue = new ActivityDeliveryQueue(false);

    // Access private method via type assertion for testing
    const checkRateLimit = (queue as any).checkRateLimit.bind(queue);

    // Use up the rate limit
    for (let i = 0; i < 10; i++) {
      checkRateLimit("test.example.com");
    }

    // 11th delivery should be blocked
    expect(checkRateLimit("test.example.com")).toBe(false);
  });

  test("should track rate limits separately per server", () => {
    const queue = new ActivityDeliveryQueue(false);

    // Access private method via type assertion for testing
    const checkRateLimit = (queue as any).checkRateLimit.bind(queue);

    // Use up rate limit for server1
    for (let i = 0; i < 10; i++) {
      checkRateLimit("server1.example.com");
    }

    // Server2 should still be allowed
    expect(checkRateLimit("server2.example.com")).toBe(true);
    expect(checkRateLimit("server1.example.com")).toBe(false);
  });

  test("should calculate delay when rate limit exceeded", () => {
    const queue = new ActivityDeliveryQueue(false);

    // Access private methods via type assertion for testing
    const checkRateLimit = (queue as any).checkRateLimit.bind(queue);
    const calculateRateLimitDelay = (queue as any).calculateRateLimitDelay.bind(queue);

    // No delay needed initially
    expect(calculateRateLimitDelay("test.example.com")).toBe(0);

    // Use up the rate limit
    for (let i = 0; i < 10; i++) {
      checkRateLimit("test.example.com");
    }

    // Should now have a delay
    const delay = calculateRateLimitDelay("test.example.com");
    expect(delay).toBeGreaterThan(0);
    expect(delay).toBeLessThanOrEqual(1000); // Should be within the window (1 second)
  });
});

describe("ActivityDeliveryQueue job ID generation", () => {
  test("should generate consistent job IDs for same activity and inbox", () => {
    const queue = new ActivityDeliveryQueue(false);

    // Access private method via type assertion for testing
    const generateJobId = (queue as any).generateJobId.bind(queue);

    const jobData: DeliveryJobData = {
      activity: { id: "activity-1", type: "Follow" },
      inboxUrl: "https://remote.example/inbox",
      keyId: "key",
      privateKey: "secret",
    };

    const id1 = generateJobId(jobData);
    const id2 = generateJobId(jobData);

    expect(id1).toBe(id2);
  });

  test("should generate different job IDs for different activities", () => {
    const queue = new ActivityDeliveryQueue(false);

    // Access private method via type assertion for testing
    const generateJobId = (queue as any).generateJobId.bind(queue);

    const jobData1: DeliveryJobData = {
      activity: { id: "activity-1", type: "Follow" },
      inboxUrl: "https://remote.example/inbox",
      keyId: "key",
      privateKey: "secret",
    };

    const jobData2: DeliveryJobData = {
      activity: { id: "activity-2", type: "Follow" },
      inboxUrl: "https://remote.example/inbox",
      keyId: "key",
      privateKey: "secret",
    };

    const id1 = generateJobId(jobData1);
    const id2 = generateJobId(jobData2);

    expect(id1).not.toBe(id2);
  });

  test("should generate different job IDs for different inboxes", () => {
    const queue = new ActivityDeliveryQueue(false);

    // Access private method via type assertion for testing
    const generateJobId = (queue as any).generateJobId.bind(queue);

    // Use short activity IDs to ensure inbox URL difference is captured in the hash
    const jobData1: DeliveryJobData = {
      activity: { id: "a1", type: "Follow" },
      inboxUrl: "https://s1.example/inbox",
      keyId: "key",
      privateKey: "secret",
    };

    const jobData2: DeliveryJobData = {
      activity: { id: "a1", type: "Follow" },
      inboxUrl: "https://s2.example/inbox",
      keyId: "key",
      privateKey: "secret",
    };

    const id1 = generateJobId(jobData1);
    const id2 = generateJobId(jobData2);

    expect(id1).not.toBe(id2);
  });

  test("should handle activities without id field", () => {
    const queue = new ActivityDeliveryQueue(false);

    // Access private method via type assertion for testing
    const generateJobId = (queue as any).generateJobId.bind(queue);

    const jobData: DeliveryJobData = {
      activity: { type: "Follow", actor: "alice", object: "bob" },
      inboxUrl: "https://remote.example/inbox",
      keyId: "key",
      privateKey: "secret",
    };

    // Should not throw
    const id = generateJobId(jobData);
    expect(typeof id).toBe("string");
    expect(id.startsWith("deliver-")).toBe(true);
  });
});
