/**
 * Security Headers Middleware
 *
 * Adds security headers to all responses to protect against common
 * web vulnerabilities. Based on OWASP security best practices.
 *
 * @module middleware/securityHeaders
 */

import type { Context, Next } from "hono";

/**
 * Security headers configuration options
 */
export interface SecurityHeadersOptions {
  /**
   * Enable HSTS header (Strict-Transport-Security)
   * Only enable in production with HTTPS
   * @default true in production
   */
  enableHSTS?: boolean;

  /**
   * HSTS max-age in seconds
   * @default 31536000 (1 year)
   */
  hstsMaxAge?: number;

  /**
   * Content Security Policy directives
   * Set to false to disable CSP
   */
  contentSecurityPolicy?: string | false;

  /**
   * Enable frame options (X-Frame-Options)
   * @default 'DENY'
   */
  frameOptions?: "DENY" | "SAMEORIGIN" | false;

  /**
   * Referrer policy
   * @default 'strict-origin-when-cross-origin'
   */
  referrerPolicy?: string;
}

/**
 * Default security headers options
 */
const defaultOptions: Required<SecurityHeadersOptions> = {
  enableHSTS: process.env.NODE_ENV === "production",
  hstsMaxAge: 31536000, // 1 year
  contentSecurityPolicy:
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https:; frame-ancestors 'none'",
  frameOptions: "DENY",
  referrerPolicy: "strict-origin-when-cross-origin",
};

/**
 * Security Headers Middleware
 *
 * Adds the following security headers:
 * - X-Content-Type-Options: nosniff (prevents MIME type sniffing)
 * - X-Frame-Options: DENY (prevents clickjacking)
 * - X-XSS-Protection: 0 (legacy, modern browsers use CSP)
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Content-Security-Policy: restrictive policy
 * - Strict-Transport-Security: enables HSTS (production only)
 * - Permissions-Policy: disables sensitive features
 *
 * @param options - Configuration options
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { securityHeaders } from './middleware/securityHeaders.js';
 *
 * app.use('*', securityHeaders());
 * ```
 */
export function securityHeaders(options: SecurityHeadersOptions = {}) {
  const config = { ...defaultOptions, ...options };

  return async (c: Context, next: Next) => {
    await next();

    // Prevent MIME type sniffing
    c.header("X-Content-Type-Options", "nosniff");

    // Prevent clickjacking
    if (config.frameOptions) {
      c.header("X-Frame-Options", config.frameOptions);
    }

    // Legacy XSS protection - disabled as modern browsers use CSP
    // Setting to 0 prevents unintended side effects in older browsers
    c.header("X-XSS-Protection", "0");

    // Control referrer information
    c.header("Referrer-Policy", config.referrerPolicy);

    // Content Security Policy
    if (config.contentSecurityPolicy) {
      c.header("Content-Security-Policy", config.contentSecurityPolicy);
    }

    // HSTS - only in production with HTTPS
    if (config.enableHSTS) {
      c.header("Strict-Transport-Security", `max-age=${config.hstsMaxAge}; includeSubDomains`);
    }

    // Permissions Policy - disable sensitive browser features
    c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), interest-cohort=()");

    // Prevent caching of sensitive data (for API responses)
    // Only apply to API routes, not static assets
    const path = c.req.path;
    if (path.startsWith("/api/") && !path.includes("/public/")) {
      c.header("Cache-Control", "no-store, no-cache, must-revalidate, private");
      c.header("Pragma", "no-cache");
    }
  };
}

/**
 * ActivityPub-specific security headers
 *
 * Relaxes some headers for ActivityPub endpoints that need
 * to be accessed by other servers.
 *
 * @returns Hono middleware function
 */
export function activityPubSecurityHeaders() {
  return async (c: Context, next: Next) => {
    await next();

    // Basic security headers still apply
    c.header("X-Content-Type-Options", "nosniff");
    c.header("X-XSS-Protection", "0");
    c.header("Referrer-Policy", "strict-origin-when-cross-origin");

    // Allow framing for ActivityPub content (some clients embed)
    // But still prevent framing from arbitrary sites
    c.header("X-Frame-Options", "SAMEORIGIN");

    // Relaxed CSP for ActivityPub - allow external resources
    c.header("Content-Security-Policy", "default-src 'self'; img-src * data:; media-src *");
  };
}
