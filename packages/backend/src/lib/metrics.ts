/**
 * Prometheus Metrics Service
 *
 * Collects and exposes application metrics for monitoring.
 * Uses prom-client library for Prometheus-compatible metrics.
 *
 * @module lib/metrics
 */

import client from "prom-client";

/**
 * Initialize default metrics collection
 */
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({
  prefix: "rox_",
  labels: { app: "rox" },
});

/**
 * HTTP request duration histogram
 *
 * Tracks the duration of HTTP requests by method, route, and status.
 */
export const httpRequestDuration = new client.Histogram({
  name: "rox_http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route", "status_code"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

/**
 * HTTP request counter
 *
 * Counts the total number of HTTP requests by method, route, and status.
 */
export const httpRequestTotal = new client.Counter({
  name: "rox_http_requests_total",
  help: "Total number of HTTP requests",
  labelNames: ["method", "route", "status_code"],
});

/**
 * ActivityPub delivery counter
 *
 * Counts the total number of ActivityPub delivery attempts.
 */
export const activityDeliveryTotal = new client.Counter({
  name: "rox_activitypub_delivery_total",
  help: "Total number of ActivityPub delivery attempts",
  labelNames: ["activity_type", "status"],
});

/**
 * ActivityPub delivery duration histogram
 *
 * Tracks the duration of ActivityPub delivery attempts.
 */
export const activityDeliveryDuration = new client.Histogram({
  name: "rox_activitypub_delivery_duration_seconds",
  help: "Duration of ActivityPub delivery attempts in seconds",
  labelNames: ["activity_type"],
  buckets: [0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30, 60],
});

/**
 * ActivityPub inbox processing counter
 *
 * Counts the total number of ActivityPub inbox activities processed.
 */
export const activityInboxTotal = new client.Counter({
  name: "rox_activitypub_inbox_total",
  help: "Total number of ActivityPub inbox activities processed",
  labelNames: ["activity_type", "status"],
});

/**
 * Database query counter
 *
 * Counts the total number of database queries by operation type.
 */
export const dbQueryTotal = new client.Counter({
  name: "rox_db_queries_total",
  help: "Total number of database queries",
  labelNames: ["operation", "table"],
});

/**
 * Cache operation counter
 *
 * Counts cache hits, misses, and sets.
 */
export const cacheOperationTotal = new client.Counter({
  name: "rox_cache_operations_total",
  help: "Total number of cache operations",
  labelNames: ["operation", "result"],
});

/**
 * Queue depth gauge
 *
 * Tracks the current number of jobs in the activity delivery queue.
 */
export const queueDepth = new client.Gauge({
  name: "rox_queue_depth",
  help: "Current number of jobs in queue",
  labelNames: ["queue_name", "state"],
});

/**
 * Active users gauge
 *
 * Tracks the number of active users (sessions in last 24 hours).
 */
export const activeUsers = new client.Gauge({
  name: "rox_active_users",
  help: "Number of active users",
});

/**
 * Total notes counter
 *
 * Tracks the total number of notes in the database.
 */
export const totalNotes = new client.Gauge({
  name: "rox_total_notes",
  help: "Total number of notes",
});

/**
 * Total users counter
 *
 * Tracks the total number of users in the database.
 */
export const totalUsers = new client.Gauge({
  name: "rox_total_users",
  help: "Total number of users",
  labelNames: ["type"], // 'local' or 'remote'
});

/**
 * Get the metrics registry
 */
export const register = client.register;

/**
 * Record HTTP request metrics
 *
 * @param method - HTTP method
 * @param route - Route path
 * @param statusCode - HTTP status code
 * @param duration - Request duration in seconds
 */
export function recordHttpRequest(
  method: string,
  route: string,
  statusCode: number,
  duration: number,
): void {
  const labels = {
    method,
    route: normalizeRoute(route),
    status_code: String(statusCode),
  };

  httpRequestTotal.inc(labels);
  httpRequestDuration.observe(labels, duration);
}

/**
 * Record ActivityPub delivery metrics
 *
 * @param activityType - Type of activity (Create, Follow, etc.)
 * @param success - Whether delivery was successful
 * @param duration - Delivery duration in seconds
 */
export function recordActivityDelivery(
  activityType: string,
  success: boolean,
  duration: number,
): void {
  activityDeliveryTotal.inc({
    activity_type: activityType,
    status: success ? "success" : "failure",
  });
  activityDeliveryDuration.observe({ activity_type: activityType }, duration);
}

/**
 * Record ActivityPub inbox metrics
 *
 * @param activityType - Type of activity processed
 * @param success - Whether processing was successful
 */
export function recordInboxActivity(activityType: string, success: boolean): void {
  activityInboxTotal.inc({
    activity_type: activityType,
    status: success ? "success" : "failure",
  });
}

/**
 * Record cache operation metrics
 *
 * @param operation - Cache operation (get, set, delete)
 * @param hit - Whether it was a cache hit (for get operations)
 */
export function recordCacheOperation(operation: "get" | "set" | "delete", hit?: boolean): void {
  if (operation === "get") {
    cacheOperationTotal.inc({
      operation,
      result: hit ? "hit" : "miss",
    });
  } else {
    cacheOperationTotal.inc({
      operation,
      result: "success",
    });
  }
}

/**
 * Normalize route path for consistent labeling
 *
 * Replaces dynamic segments with placeholders.
 *
 * @param route - Route path
 * @returns Normalized route
 */
function normalizeRoute(route: string): string {
  // Replace IDs and usernames with placeholders
  return route
    .replace(/\/[a-z0-9]{16,}/gi, "/:id")
    .replace(/\/@[^/]+/, "/@:username")
    .replace(/\/users\/[^/]+/, "/users/:username");
}

/**
 * Get all metrics as Prometheus format text
 *
 * @returns Prometheus format metrics string
 */
export async function getMetrics(): Promise<string> {
  return register.metrics();
}

/**
 * Get content type for metrics response
 */
export function getMetricsContentType(): string {
  return register.contentType;
}
