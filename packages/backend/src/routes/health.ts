/**
 * Health Check Routes
 *
 * Provides health check endpoints for container orchestration and monitoring.
 * - /health: Basic liveness check
 * - /health/ready: Readiness check with dependency status
 *
 * @module routes/health
 */

import { Hono } from "hono";
import { getDatabase } from "../db/index.js";
import type { ICacheService } from "../interfaces/ICacheService.js";
import {
  getNotificationStreamService,
  type ConnectionMetrics,
} from "../services/NotificationStreamService.js";
import packageJson from "../../../../package.json";

const app = new Hono();

/**
 * Health check response type
 */
interface HealthResponse {
  status: "ok" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
}

/**
 * Readiness check response type
 */
interface ReadinessResponse extends HealthResponse {
  checks: {
    database: {
      status: "ok" | "error";
      latency?: number;
      error?: string;
    };
    cache: {
      status: "ok" | "unavailable";
      latency?: number;
    };
    queue?: {
      status: "ok" | "unavailable";
    };
  };
}

// Track server start time for uptime calculation
const startTime = Date.now();

/**
 * GET /health
 *
 * Basic liveness check. Returns 200 if the server is running.
 * Use this for Kubernetes liveness probes.
 *
 * @example
 * ```bash
 * curl http://localhost:3000/health
 * ```
 *
 * @returns Health status with version and uptime
 */
app.get("/", (c) => {
  const response: HealthResponse = {
    status: "ok",
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    uptime: Math.floor((Date.now() - startTime) / 1000),
  };

  return c.json(response);
});

/**
 * GET /health/ready
 *
 * Readiness check with dependency status. Returns 200 if all dependencies
 * are healthy, 503 if any critical dependency is unavailable.
 * Use this for Kubernetes readiness probes.
 *
 * @example
 * ```bash
 * curl http://localhost:3000/health/ready
 * ```
 *
 * @returns Detailed health status including database and cache status
 */
app.get("/ready", async (c) => {
  const cacheService = c.get("cacheService") as ICacheService | undefined;

  // Check database connection
  const dbCheck = await checkDatabase();

  // Check cache connection
  const cacheCheck = checkCache(cacheService);

  // Determine overall status
  const isHealthy = dbCheck.status === "ok";
  const isDegraded = dbCheck.status === "ok" && cacheCheck.status === "unavailable";

  const response: ReadinessResponse = {
    status: isHealthy ? (isDegraded ? "degraded" : "ok") : "unhealthy",
    timestamp: new Date().toISOString(),
    version: packageJson.version,
    uptime: Math.floor((Date.now() - startTime) / 1000),
    checks: {
      database: dbCheck,
      cache: cacheCheck,
    },
  };

  // Return 503 if database is unavailable (critical dependency)
  if (!isHealthy) {
    return c.json(response, 503);
  }

  return c.json(response);
});

/**
 * Check database connection
 *
 * Executes a simple query to verify database connectivity.
 *
 * @returns Database check result with status and latency
 */
async function checkDatabase(): Promise<{
  status: "ok" | "error";
  latency?: number;
  error?: string;
}> {
  const start = Date.now();

  try {
    const db = getDatabase();
    // Execute a simple query to check connectivity
    await db.execute("SELECT 1");

    return {
      status: "ok",
      latency: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "error",
      latency: Date.now() - start,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Check cache connection
 *
 * Verifies cache service availability.
 *
 * @param cacheService - Cache service instance
 * @returns Cache check result with status
 */
function checkCache(cacheService?: ICacheService): {
  status: "ok" | "unavailable";
  latency?: number;
} {
  if (!cacheService) {
    return { status: "unavailable" };
  }

  const start = Date.now();
  const isAvailable = cacheService.isAvailable();

  return {
    status: isAvailable ? "ok" : "unavailable",
    latency: Date.now() - start,
  };
}

/**
 * SSE health response type
 */
interface SSEHealthResponse {
  status: "ok" | "degraded" | "unhealthy";
  timestamp: string;
  metrics: ConnectionMetrics;
  health: {
    isHealthy: boolean;
    connectionLimit: number;
    connectionUsagePercent: number;
  };
}

/**
 * GET /health/sse
 *
 * SSE (Server-Sent Events) health check endpoint.
 * Returns metrics about SSE notification stream connections.
 *
 * @example
 * ```bash
 * curl http://localhost:3000/health/sse
 * ```
 *
 * @returns SSE metrics including connections, messages sent, and memory usage
 */
app.get("/sse", (c) => {
  const streamService = getNotificationStreamService();
  const metrics = streamService.getMetrics();
  const isHealthy = streamService.isHealthy();

  // Define connection limit (matches EventEmitter max listeners)
  const connectionLimit = 10000;
  const connectionUsagePercent = (metrics.totalConnections / connectionLimit) * 100;

  // Determine status
  let status: "ok" | "degraded" | "unhealthy" = "ok";
  if (!isHealthy) {
    status = "unhealthy";
  } else if (connectionUsagePercent > 80) {
    status = "degraded";
  }

  const response: SSEHealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    metrics,
    health: {
      isHealthy,
      connectionLimit,
      connectionUsagePercent: Math.round(connectionUsagePercent * 100) / 100,
    },
  };

  if (!isHealthy) {
    return c.json(response, 503);
  }

  return c.json(response);
});

export default app;
