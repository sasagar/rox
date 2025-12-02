/**
 * Media Proxy Routes
 *
 * Proxies and caches remote media files to:
 * - Improve loading performance for users
 * - Reduce load on remote servers
 * - Provide content-type validation for security
 *
 * @module routes/proxy
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { createHash } from "node:crypto";

const proxy = new Hono();

/**
 * Allowed MIME types for proxying
 */
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
  // Audio
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
  // Video
  "video/mp4",
  "video/webm",
  "video/ogg",
]);

/**
 * Maximum file size for proxying (10MB)
 */
const MAX_PROXY_SIZE = 10 * 1024 * 1024;

/**
 * Cache duration headers (1 day for success, 1 hour for errors)
 */
const CACHE_SUCCESS = "public, max-age=86400, immutable";
const CACHE_ERROR = "public, max-age=3600";

/**
 * Generate cache key from URL
 */
function getCacheKey(url: string): string {
  return createHash("sha256").update(url).digest("hex");
}

/**
 * GET /proxy
 *
 * Proxy remote media files with caching and validation.
 *
 * @query {string} url - URL of the remote media to proxy (URL-encoded)
 * @returns Proxied media content with appropriate headers
 *
 * @example
 * GET /proxy?url=https%3A%2F%2Fremote.server%2Fimage.jpg
 */
proxy.get("/", async (c: Context) => {
  const url = c.req.query("url");

  if (!url) {
    return c.json({ error: "url parameter is required" }, 400);
  }

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return c.json({ error: "Invalid URL format" }, 400);
  }

  // Only allow http/https
  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return c.json({ error: "Only HTTP/HTTPS URLs are allowed" }, 400);
  }

  // Block localhost/private IPs for security
  const hostname = parsedUrl.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.startsWith("192.168.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("172.") ||
    hostname.endsWith(".local")
  ) {
    return c.json({ error: "Private addresses are not allowed" }, 403);
  }

  const cacheService = c.get("cacheService");
  const cacheKey = `proxy:${getCacheKey(url)}`;

  // Check cache first
  if (cacheService?.isAvailable()) {
    const cached = await cacheService.get<{
      data: string; // Base64 encoded
      contentType: string;
    }>(cacheKey);

    if (cached) {
      const buffer = Buffer.from(cached.data, "base64");
      c.header("Content-Type", cached.contentType);
      c.header("Cache-Control", CACHE_SUCCESS);
      c.header("X-Cache", "HIT");
      return c.body(buffer);
    }
  }

  // Fetch from remote
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Rox/1.0 (ActivityPub; +https://github.com/example/rox)",
        Accept: "image/*,video/*,audio/*",
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      c.header("Cache-Control", CACHE_ERROR);
      return c.json(
        { error: `Remote server returned ${response.status}` },
        response.status as 400 | 404 | 500,
      );
    }

    // Validate content type
    const rawContentType = response.headers.get("content-type") || "";
    const contentType = (rawContentType.split(";")[0] ?? "").trim();
    if (!contentType || !ALLOWED_MIME_TYPES.has(contentType)) {
      c.header("Cache-Control", CACHE_ERROR);
      return c.json({ error: `Content type not allowed: ${contentType}` }, 415);
    }

    // Check content length
    const contentLength = response.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_PROXY_SIZE) {
      c.header("Cache-Control", CACHE_ERROR);
      return c.json({ error: "File too large" }, 413);
    }

    // Read body with size limit
    const chunks: Uint8Array[] = [];
    let totalSize = 0;
    const reader = response.body?.getReader();

    if (!reader) {
      return c.json({ error: "Failed to read response" }, 500);
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalSize += value.length;
      if (totalSize > MAX_PROXY_SIZE) {
        reader.cancel();
        c.header("Cache-Control", CACHE_ERROR);
        return c.json({ error: "File too large" }, 413);
      }

      chunks.push(value);
    }

    // Combine chunks
    const buffer = Buffer.concat(chunks);

    // Cache the result
    if (cacheService?.isAvailable()) {
      await cacheService.set(
        cacheKey,
        {
          data: buffer.toString("base64"),
          contentType,
        },
        { ttl: 86400 }, // 24 hours
      );
    }

    // Return response
    c.header("Content-Type", contentType);
    c.header("Cache-Control", CACHE_SUCCESS);
    c.header("X-Cache", "MISS");
    c.header("X-Content-Type-Options", "nosniff");
    return c.body(buffer);
  } catch (error) {
    console.error(`Proxy fetch error for ${url}:`, error);

    if (error instanceof Error && error.name === "AbortError") {
      c.header("Cache-Control", CACHE_ERROR);
      return c.json({ error: "Request timeout" }, 504);
    }

    c.header("Cache-Control", CACHE_ERROR);
    return c.json({ error: "Failed to fetch remote media" }, 502);
  }
});

/**
 * GET /proxy/avatar
 *
 * Specialized endpoint for avatar images with fallback.
 *
 * @query {string} url - URL of the avatar image
 * @returns Avatar image or default fallback
 */
proxy.get("/avatar", async (c: Context) => {
  const url = c.req.query("url");

  if (!url) {
    // Return default avatar placeholder
    c.header("Content-Type", "image/svg+xml");
    c.header("Cache-Control", CACHE_SUCCESS);
    return c.body(DEFAULT_AVATAR_SVG);
  }

  // Delegate to main proxy handler
  // In case of error, return default avatar
  try {
    const proxyUrl = new URL("/proxy", c.req.url);
    proxyUrl.searchParams.set("url", url);

    const response = await fetch(proxyUrl.toString());
    if (response.ok) {
      const contentType = response.headers.get("content-type") || "image/png";
      c.header("Content-Type", contentType);
      c.header("Cache-Control", CACHE_SUCCESS);
      return c.body(await response.arrayBuffer());
    }
  } catch {
    // Fall through to default avatar
  }

  c.header("Content-Type", "image/svg+xml");
  c.header("Cache-Control", CACHE_SUCCESS);
  return c.body(DEFAULT_AVATAR_SVG);
});

/**
 * Default avatar SVG placeholder
 */
const DEFAULT_AVATAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#e0e0e0"/>
  <circle cx="50" cy="35" r="20" fill="#9e9e9e"/>
  <ellipse cx="50" cy="85" rx="35" ry="25" fill="#9e9e9e"/>
</svg>`;

export default proxy;
