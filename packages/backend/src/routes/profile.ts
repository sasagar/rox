/**
 * Profile Routes
 *
 * Handles /@username style URLs for user profiles.
 * Serves OGP HTML for embed crawlers (Discord, Slack, etc.)
 * and ActivityPub actor documents for federation.
 * Browser requests are redirected to the frontend.
 *
 * @module routes/profile
 */

import { Hono } from "hono";
import type { Context } from "hono";
import {
  isActivityPubRequest,
} from "../lib/crawlerDetection.js";

const profile = new Hono();

/**
 * Parse username parameter from /@username format
 *
 * Supports formats:
 * - "@alice" -> { username: "alice", host: null }
 * - "@alice@mastodon.social" -> { username: "alice", host: "mastodon.social" }
 *
 * @param param - Username parameter with @ prefix
 * @returns Parsed username and host
 */
function parseUserParam(param: string): { username: string; host: string | null } {
  // Remove leading @ if present
  const cleaned = param.startsWith("@") ? param.slice(1) : param;

  // Check for remote user format (username@host)
  const atIndex = cleaned.indexOf("@");
  if (atIndex > 0) {
    const host = cleaned.slice(atIndex + 1);
    return {
      username: cleaned.slice(0, atIndex),
      host: host || null, // Handle edge case: "username@" → treat as local user
    };
  }

  return { username: cleaned, host: null };
}

/**
 * GET /:atuser (matches /@username)
 *
 * Handles user profile URLs in /@username format.
 * Uses /:atuser pattern because Hono doesn't match literal @ in route patterns.
 * Only handles paths starting with @ - others pass through.
 *
 * - Embed crawlers (Discord, Slack, etc.) receive OGP HTML
 * - ActivityPub requests for local users are redirected to /users/:username
 * - Browser requests receive redirect to frontend
 *
 * @param atuser - Path segment (e.g., "@alice" or "@alice@mastodon.social")
 * @returns OGP HTML, redirect, or 404
 *
 * @example
 * ```bash
 * # Discord crawler (returns OGP HTML)
 * curl -H "User-Agent: Discordbot/2.0" https://example.com/@alice
 *
 * # ActivityPub request (redirects to /users/alice for local users)
 * curl -H "Accept: application/activity+json" https://example.com/@alice
 *
 * # Browser request (receives frontend page)
 * curl https://example.com/@alice
 * ```
 */
profile.get("/:atuser", async (c: Context, next) => {
  const atuser = c.req.param("atuser");

  // Only handle paths starting with @ (user profile URLs)
  // For other paths, pass through to next handler
  if (!atuser || !atuser.startsWith("@")) {
    return next();
  }

  const accept = c.req.header("Accept") || "";

  const { username, host } = parseUserParam(atuser);

  // Check if this is an ActivityPub request
  if (isActivityPubRequest(accept)) {
    // For local users, redirect to canonical /users/:username endpoint
    // Remote users don't have ActivityPub endpoints on this server
    if (!host) {
      return c.redirect(`/users/${username}`, 301);
    }
    // Remote user ActivityPub should go to their origin server
    return c.notFound();
  }

  // EXPERIMENT: Return 404 for all non-ActivityPub requests (including embed crawlers)
  // This allows nginx to route to frontend, which now serves full SPA with OGP meta tags
  // This matches Misskey's approach where Discord bots receive the full page with embedded meta tags
  //
  // Previous approach: Serve minimal OGP HTML for embed crawlers
  // if (isEmbedCrawler(userAgent)) {
  //   return handleUserOgpRequest(c, username, host);
  // }

  // Return 404 so nginx routes to frontend (Waku SSR with OGP meta tags)
  return c.notFound();
});

export default profile;
