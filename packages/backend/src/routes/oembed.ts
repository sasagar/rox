/**
 * oEmbed Endpoint
 *
 * Provides oEmbed responses for notes and user profiles.
 * Discord, Slack, and other platforms use oEmbed for rich embed features
 * like author name, author icon, footer, and more.
 *
 * @see https://oembed.com/
 * @module routes/oembed
 */

import { Hono } from "hono";
import type { Context } from "hono";
import {
  generateNoteOEmbed,
  generateUserOEmbed,
  type OEmbedResponse,
} from "../lib/oembed.js";

const oembed = new Hono();

/**
 * Parse URL to determine resource type and ID
 *
 * @param url - The URL to parse
 * @param baseUrl - The instance base URL
 * @returns Parsed resource info or null if invalid
 */
function parseResourceUrl(
  url: string,
  baseUrl: string,
): { type: "note"; id: string } | { type: "user"; username: string; host: string | null } | null {
  try {
    const parsed = new URL(url);
    const baseParsed = new URL(baseUrl);

    // Verify it's from our instance
    if (parsed.host !== baseParsed.host) {
      return null;
    }

    const pathname = parsed.pathname;

    // Match /notes/:id
    const noteMatch = pathname.match(/^\/notes\/([^/]+)$/);
    if (noteMatch && noteMatch[1]) {
      return { type: "note", id: noteMatch[1] };
    }

    // Match /@username or /@username@host
    const userMatch = pathname.match(/^\/@([^@/]+)(?:@([^/]+))?$/);
    if (userMatch && userMatch[1]) {
      return {
        type: "user",
        username: userMatch[1],
        host: userMatch[2] || null,
      };
    }

    // Match /users/:username (ActivityPub URL)
    const usersMatch = pathname.match(/^\/users\/([^/]+)$/);
    if (usersMatch && usersMatch[1]) {
      return {
        type: "user",
        username: usersMatch[1],
        host: null,
      };
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * GET /oembed
 *
 * Returns oEmbed JSON response for a given URL.
 * Supports both notes and user profiles.
 *
 * Query Parameters:
 * - url (required): The URL of the resource to get oEmbed data for
 * - format (optional): Response format, only "json" is supported
 * - maxwidth (optional): Maximum width for embedded content
 * - maxheight (optional): Maximum height for embedded content
 *
 * @example
 * ```bash
 * # Get oEmbed for a note
 * curl "https://example.com/oembed?url=https://example.com/notes/abc123"
 *
 * # Get oEmbed for a user profile
 * curl "https://example.com/oembed?url=https://example.com/@alice"
 * ```
 */
oembed.get("/", async (c: Context) => {
  const url = c.req.query("url");
  const format = c.req.query("format") || "json";

  // Validate format (only JSON is supported)
  if (format !== "json") {
    return c.json(
      { error: "Unsupported format. Only 'json' is supported." },
      501,
    );
  }

  // URL is required
  if (!url) {
    return c.json({ error: "Missing required parameter: url" }, 400);
  }

  const baseUrl = process.env.URL || "http://localhost:3000";
  const resource = parseResourceUrl(url, baseUrl);

  if (!resource) {
    return c.json({ error: "Invalid or unsupported URL" }, 404);
  }

  let response: OEmbedResponse;

  if (resource.type === "note") {
    // Get note data
    const noteRepository = c.get("noteRepository");
    const noteData = await noteRepository.findById(resource.id);

    if (!noteData || noteData.isDeleted) {
      return c.json({ error: "Note not found" }, 404);
    }

    // Get note author
    const userRepository = c.get("userRepository");
    const author = await userRepository.findById(noteData.userId);

    if (!author) {
      return c.json({ error: "Author not found" }, 404);
    }

    // Get first image from attachments
    let imageUrl: string | null = null;
    if (noteData.fileIds && noteData.fileIds.length > 0) {
      const driveFileRepository = c.get("driveFileRepository");
      for (const fileId of noteData.fileIds) {
        const file = await driveFileRepository.findById(fileId);
        if (file && file.type.startsWith("image/")) {
          imageUrl = file.url;
          break;
        }
      }
    }

    // Get instance settings
    const instanceSettingsService = c.get("instanceSettingsService");
    const instanceInfo = await instanceSettingsService.getPublicInstanceInfo();

    response = generateNoteOEmbed({
      noteId: noteData.id,
      text: noteData.text,
      cw: noteData.cw,
      authorUsername: author.username,
      authorDisplayName: author.displayName,
      authorHost: author.host,
      authorAvatarUrl: author.avatarUrl,
      imageUrl,
      createdAt: noteData.createdAt?.toISOString() || null,
      baseUrl,
      instanceName: instanceInfo.name,
      instanceIconUrl: instanceInfo.iconUrl,
    });
  } else {
    // Get user data
    const userRepository = c.get("userRepository");
    const user = await userRepository.findByUsername(resource.username, resource.host);

    if (!user || user.isDeleted) {
      return c.json({ error: "User not found" }, 404);
    }

    // Get instance settings
    const instanceSettingsService = c.get("instanceSettingsService");
    const instanceInfo = await instanceSettingsService.getPublicInstanceInfo();

    response = generateUserOEmbed({
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      host: user.host,
      avatarUrl: user.avatarUrl,
      baseUrl,
      instanceName: instanceInfo.name,
      instanceIconUrl: instanceInfo.iconUrl,
    });
  }

  return c.json(response, 200, {
    "Content-Type": "application/json+oembed; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  });
});

export default oembed;
