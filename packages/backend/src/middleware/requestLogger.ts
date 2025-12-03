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

    // Log incoming request
    reqLogger.info("Incoming request");

    try {
      await next();

      // Get user ID if authenticated
      const user = c.get("user") as { id: string } | undefined;
      const duration = Date.now() - startTime;
      const status = c.res.status;

      // Log completed request
      reqLogger.info(
        {
          status,
          duration,
          ...(user && { userId: user.id }),
        },
        "Request completed",
      );
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
