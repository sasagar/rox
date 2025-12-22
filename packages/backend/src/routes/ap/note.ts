/**
 * ActivityPub Note Object Endpoint
 *
 * Serves individual notes as ActivityPub Note objects.
 * Also serves Open Graph Protocol (OGP) HTML for embed crawlers (Discord, Slack, etc.)
 * to enable rich link previews when note URLs are shared.
 *
 * @module routes/ap/note
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { logger } from "../../lib/logger.js";
import {
  isEmbedCrawler,
  isActivityPubRequest,
} from "../../lib/crawlerDetection.js";
import { generateNoteOgpHtml } from "../../lib/ogp.js";

const note = new Hono();

/**
 * Handle OGP request for embed crawlers (Discord, Slack, etc.)
 *
 * @param c - Hono context
 * @returns HTML response with OGP meta tags
 */
async function handleNoteOgpRequest(c: Context): Promise<Response> {
  const { id } = c.req.param();
  const baseUrl = process.env.URL || "http://localhost:3000";

  // Get note from repository
  const noteRepository = c.get("noteRepository");
  const noteData = await noteRepository.findById(id as string);

  if (!noteData || noteData.isDeleted) {
    return c.notFound();
  }

  // Get note author
  const userRepository = c.get("userRepository");
  const author = await userRepository.findById(noteData.userId);

  if (!author) {
    return c.notFound();
  }

  // Get first image from attachments (if any)
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

  // Fallback to instance icon if no image
  if (!imageUrl) {
    imageUrl = instanceInfo.iconUrl;
  }

  const html = generateNoteOgpHtml({
    noteId: noteData.id,
    text: noteData.text,
    cw: noteData.cw,
    authorUsername: author.username,
    authorDisplayName: author.displayName,
    authorHost: author.host,
    imageUrl,
    baseUrl,
    instanceName: instanceInfo.name,
    themeColor: instanceInfo.theme.primaryColor,
  });

  return c.html(html, 200, {
    // Cache OGP responses for 5 minutes to reduce load from embed crawlers
    "Cache-Control": "public, max-age=300",
  });
}

/**
 * GET /notes/:id
 *
 * Returns an ActivityPub Note object for the specified note ID.
 * Also serves OGP HTML for embed crawlers (Discord, Slack, etc.)
 *
 * @param id - Note ID
 * @returns ActivityPub Note object (application/activity+json) or OGP HTML
 *
 * @example
 * ```bash
 * # ActivityPub request
 * curl -H "Accept: application/activity+json" \
 *   https://example.com/notes/abc123
 *
 * # Discord/Slack crawler (returns OGP HTML)
 * curl -H "User-Agent: Discordbot/2.0" \
 *   https://example.com/notes/abc123
 * ```
 */
note.get("/notes/:id", async (c: Context) => {
  const { id } = c.req.param();
  const accept = c.req.header("Accept") || "";
  const userAgent = c.req.header("User-Agent") || "";

  // Check if this is an ActivityPub request
  if (isActivityPubRequest(accept)) {
    // Continue with ActivityPub handling below
  } else if (isEmbedCrawler(userAgent)) {
    // Serve OGP HTML for embed crawlers
    return handleNoteOgpRequest(c);
  } else {
    // Regular browser request - pass to frontend
    return c.text("", 404);
  }

  // Get note from repository
  const noteRepository = c.get("noteRepository");
  const noteData = await noteRepository.findById(id as string);

  if (!noteData) {
    return c.notFound();
  }

  const baseUrl = process.env.URL || "http://localhost:3000";

  // 410 Gone if note is deleted (ActivityPub spec compliance)
  if (noteData.isDeleted) {
    // Return a Tombstone object for deleted notes
    return c.json(
      {
        "@context": "https://www.w3.org/ns/activitystreams",
        id: noteData.uri || `${baseUrl}/notes/${noteData.id}`,
        type: "Tombstone",
        deleted: noteData.deletedAt?.toISOString(),
      },
      410,
      {
        "Content-Type": "application/activity+json; charset=utf-8",
      },
    );
  }

  // Get note author
  const userRepository = c.get("userRepository");
  const author = await userRepository.findById(noteData.userId);

  if (!author) {
    logger.error({ userId: noteData.userId }, "Note author not found");
    return c.notFound();
  }

  // Construct author URI
  const authorUri = author.host
    ? `https://${author.host}/users/${author.username}` // Remote user
    : `${baseUrl}/users/${author.username}`; // Local user

  // Build ActivityPub Note object
  const apNote: any = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: noteData.uri || `${baseUrl}/notes/${noteData.id}`,
    type: "Note",
    attributedTo: authorUri,
    content: noteData.text || "",
    published: noteData.createdAt.toISOString(),
    to: ["https://www.w3.org/ns/activitystreams#Public"],
    cc: [`${authorUri}/followers`],
  };

  // Add content warning if present
  if (noteData.cw) {
    apNote.summary = noteData.cw;
    apNote.sensitive = true;
  }

  // Add reply information
  if (noteData.replyId) {
    const replyTo = await noteRepository.findById(noteData.replyId);
    if (replyTo) {
      apNote.inReplyTo = replyTo.uri || `${baseUrl}/notes/${replyTo.id}`;
    }
  }

  // Add mentions
  if (noteData.mentions && noteData.mentions.length > 0) {
    const mentionedUsers = await Promise.all(
      noteData.mentions.map((userId) => userRepository.findById(userId)),
    );

    apNote.tag = mentionedUsers
      .filter((u) => u !== null)
      .map((u) => ({
        type: "Mention",
        href: u!.host
          ? `https://${u!.host}/users/${u!.username}`
          : `${baseUrl}/users/${u!.username}`,
        name: `@${u!.username}${u!.host ? `@${u!.host}` : ""}`,
      }));
  }

  // Add file attachments
  if (noteData.fileIds && noteData.fileIds.length > 0) {
    const driveFileRepository = c.get("driveFileRepository");
    const files = await Promise.all(
      noteData.fileIds.map((fileId) => driveFileRepository.findById(fileId)),
    );

    apNote.attachment = files
      .filter((f) => f !== null)
      .map((f) => ({
        type: "Document",
        mediaType: f!.type,
        url: f!.url,
        name: f!.name || undefined,
      }));
  }

  return c.json(apNote, 200, {
    "Content-Type": "application/activity+json; charset=utf-8",
  });
});

export default note;
