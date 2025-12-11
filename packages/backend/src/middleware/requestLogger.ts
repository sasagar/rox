/**
 * Request Logger Middleware
 *
 * Provides structured request/response logging with timing and request IDs.
 *
 * @module middleware/requestLogger
 */

import type { Context, Next } from "hono";
import { createRequestLogger } from "../lib/logger.js";

/**
 * Paths that should always be logged at DEBUG level
 * regardless of status code (to reduce log noise).
 */
const DEBUG_ONLY_PATH_PREFIXES = [
  "/ws/",
  "/health",
  "/.well-known/",
  "/nodeinfo",
  "/favicon",
] as const;

/**
 * Check if a path should always be logged at DEBUG level
 *
 * @param path - Request path
 * @returns True if path should use DEBUG level
 */
function isDebugOnlyPath(path: string): boolean {
  return DEBUG_ONLY_PATH_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Get appropriate log level based on HTTP status code
 *
 * @param status - HTTP status code
 * @returns Log level: "debug" for 2xx, "warn" for 4xx, "error" for 5xx
 */
function getLogLevelForStatus(status: number): "debug" | "warn" | "error" {
  if (status >= 500) return "error";
  if (status >= 400) return "warn";
  return "debug";
}

/**
 * Generate a unique request ID
 *
 * Uses crypto.randomUUID if available, falls back to timestamp-based ID.
 *
 * @returns Unique request ID
 */
function generateRequestId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Get client IP from request headers
 *
 * @param c - Hono context
 * @returns Client IP address
 */
function getClientIP(c: Context): string {
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    const firstIP = forwarded.split(",")[0];
    return firstIP?.trim() || "unknown";
  }
  return c.req.header("x-real-ip") || "unknown";
}

/**
 * Request Logger Middleware
 *
 * Logs incoming requests and outgoing responses with:
 * - Unique request ID (added to response headers)
 * - Request method, path, and client IP
 * - Response status code and duration
 * - User ID (if authenticated)
 *
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { requestLogger } from './middleware/requestLogger.js';
 *
 * app.use('*', requestLogger());
 * ```
 */
export function requestLogger() {
  return async (c: Context, next: Next) => {
    const requestId = generateRequestId();
    const startTime = Date.now();
    const method = c.req.method;
    const path = c.req.path;
    const ip = getClientIP(c);

    // Set request ID in context for use by other middleware
    c.set("requestId", requestId);

    // Add request ID to response headers
    c.header("X-Request-ID", requestId);

    // Create request-scoped logger
    const reqLogger = createRequestLogger({
      requestId,
      method,
      path,
      ip,
    });

    // Log incoming request (always DEBUG to reduce noise)
    reqLogger.debug("Incoming request");

    try {
      await next();

      // Get user ID if authenticated
      const user = c.get("user") as { id: string } | undefined;
      const duration = Date.now() - startTime;
      const status = c.res.status;

      const logData = {
        status,
        duration,
        ...(user && { userId: user.id }),
      };

      // Use DEBUG level for specific paths (WebSocket, health checks, etc.)
      // Otherwise use status-code-based log level
      if (isDebugOnlyPath(path)) {
        reqLogger.debug(logData, "Request completed");
      } else {
        const level = getLogLevelForStatus(status);
        reqLogger[level](logData, "Request completed");
      }
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log error
      reqLogger.error(
        {
          err: error,
          duration,
        },
        "Request failed",
      );

      throw error;
    }
  };
}

// Extend Hono Context type
declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

export default requestLogger;
