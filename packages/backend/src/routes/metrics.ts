/**
 * Metrics API Route
 *
 * Exposes Prometheus-compatible metrics endpoint.
 *
 * @module routes/metrics
 */

import { Hono } from "hono";
import { getMetrics, getMetricsContentType } from "../lib/metrics.js";
import { logger } from "../lib/logger.js";

const app = new Hono();

/**
 * Get Prometheus Metrics
 *
 * GET /metrics
 *
 * Returns all collected metrics in Prometheus format.
 * This endpoint should be protected in production or
 * only accessible from internal networks.
 *
 * @remarks
 * Response (200):
 * ```text
 * # HELP rox_http_requests_total Total number of HTTP requests
 * # TYPE rox_http_requests_total counter
 * rox_http_requests_total{method="GET",route="/api/notes",status_code="200"} 42
 * ...
 * ```
 */
app.get("/", async (c) => {
  try {
    const metrics = await getMetrics();
    return new Response(metrics, {
      headers: {
        "Content-Type": getMetricsContentType(),
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to get metrics");
    return c.text("Error collecting metrics", 500);
  }
});

export default app;
