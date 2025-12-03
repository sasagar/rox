/**
 * Metrics Middleware
 *
 * Automatically records HTTP request metrics.
 *
 * @module middleware/metrics
 */

import type { Context, Next } from "hono";
import { recordHttpRequest } from "../lib/metrics.js";

/**
 * Metrics Middleware
 *
 * Records request duration and counts for all HTTP requests.
 * Should be applied as one of the first middleware.
 *
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { metricsMiddleware } from './middleware/metrics.js';
 *
 * app.use('*', metricsMiddleware());
 * ```
 */
export function metricsMiddleware() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const method = c.req.method;
    const path = c.req.path;

    // Skip metrics endpoint to avoid recursion
    if (path === "/metrics") {
      return next();
    }

    try {
      await next();

      const duration = (Date.now() - startTime) / 1000;
      const status = c.res.status;

      recordHttpRequest(method, path, status, duration);
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      recordHttpRequest(method, path, 500, duration);
      throw error;
    }
  };
}

export default metricsMiddleware;
