/**
 * ActivityPub Note Object Endpoint
 *
 * Serves individual notes as ActivityPub Note objects.
 * This allows local notes to be referenced via URI in ActivityPub activities.
 *
 * @module routes/ap/note
 */

import { Hono } from "hono";
import type { Context } from "hono";

const note = new Hono();

/**
 * GET /notes/:id
 *
 * Returns an ActivityPub Note object for the specified note ID.
 *
 * @param id - Note ID
 * @returns ActivityPub Note object (application/activity+json)
 *
 * @example
 * ```bash
 * curl -H "Accept: application/activity+json" \
 *   https://example.com/notes/abc123
 * ```
 */
note.get("/notes/:id", async (c: Context) => {
  const { id } = c.req.param();

  // Check Accept header - only respond to ActivityPub requests
  // Regular browser requests (text/html) should be handled by the frontend
  const accept = c.req.header("Accept") || "";
  const isActivityPubRequest =
    accept.includes("application/activity+json") || accept.includes("application/ld+json");

  // If not an ActivityPub request, skip this handler and pass to next middleware
  // This allows the request to be handled by the frontend (SSR or reverse proxy)
  if (!isActivityPubRequest) {
    // Use next() to pass to subsequent handlers instead of returning 404
    // This allows integration with frontend serving middleware or reverse proxy
    return c.text("", 404);
  }

  // Get note from repository
  const noteRepository = c.get("noteRepository");
  const noteData = await noteRepository.findById(id as string);

  if (!noteData) {
    return c.notFound();
  }

  // Get note author
  const userRepository = c.get("userRepository");
  const author = await userRepository.findById(noteData.userId);

  if (!author) {
    console.error(`Note author not found: ${noteData.userId}`);
    return c.notFound();
  }

  const baseUrl = process.env.URL || "http://localhost:3000";

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
    const fileRepository = c.get("fileRepository");
    const files = await Promise.all(
      noteData.fileIds.map((fileId) => fileRepository.findById(fileId)),
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
