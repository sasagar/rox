/**
 * Remote Note Service
 *
 * Handles processing and storing remote ActivityPub notes (posts).
 * Converts ActivityPub Note objects to local database records.
 *
 * @module services/ap/RemoteNoteService
 */

import type { INoteRepository } from "../../interfaces/repositories/INoteRepository.js";
import type { IUserRepository } from "../../interfaces/repositories/IUserRepository.js";
import type { ICustomEmojiRepository } from "../../interfaces/repositories/ICustomEmojiRepository.js";
import type { IDriveFileRepository } from "../../interfaces/repositories/IDriveFileRepository.js";
import type { Note } from "shared";
import { generateId } from "shared";
import { RemoteActorService } from "./RemoteActorService.js";
import { logger } from "../../lib/logger.js";

/**
 * ActivityPub Note object
 */
interface APNote {
  "@context"?: string | string[];
  id: string;
  type: string;
  attributedTo: string | { id: string };
  content?: string;
  summary?: string; // Content Warning
  published?: string;
  to?: string | string[];
  cc?: string | string[];
  inReplyTo?: string | null;
  attachment?: Array<{
    type: string;
    mediaType: string;
    url: string;
    name?: string;
  }>;
  tag?: Array<{
    type: string;
    name?: string;
    href?: string;
    icon?: {
      type?: string;
      mediaType?: string;
      url: string;
    };
  }>;
}

/**
 * Remote Note Service
 *
 * Processes incoming ActivityPub notes and stores them in the local database.
 */
export class RemoteNoteService {
  constructor(
    private noteRepository: INoteRepository,
    private userRepository: IUserRepository,
    private remoteActorService?: RemoteActorService,
    private customEmojiRepository?: ICustomEmojiRepository,
    private driveFileRepository?: IDriveFileRepository,
  ) {}

  /**
   * Process and store remote note
   *
   * Converts an ActivityPub Note to a local Note record.
   * Resolves the author and creates the note in the database.
   *
   * @param noteObject - ActivityPub Note object
   * @returns Created Note record
   *
   * @example
   * ```typescript
   * const service = new RemoteNoteService(noteRepo, userRepo);
   * const note = await service.processNote(apNoteObject);
   * ```
   */
  async processNote(noteObject: APNote): Promise<Note> {
    // Check if note already exists
    const existing = await this.noteRepository.findByUri(noteObject.id);
    if (existing) {
      logger.debug({ noteUri: noteObject.id }, "Note already exists");
      return existing;
    }

    // Resolve author (use injected service or create new instance for backward compatibility)
    const actorService = this.remoteActorService ?? new RemoteActorService(this.userRepository);
    const authorUri =
      typeof noteObject.attributedTo === "string"
        ? noteObject.attributedTo
        : noteObject.attributedTo.id;

    const author = await actorService.resolveActor(authorUri);

    // Extract text content (strip HTML tags for now)
    const text = noteObject.content ? this.stripHtml(noteObject.content) : null;

    // Extract Content Warning
    const cw = noteObject.summary || null;

    // Determine visibility from to/cc fields
    const visibility = this.determineVisibility(noteObject.to, noteObject.cc);

    // Extract mentions (user IDs) - resolve mentioned user URIs to local user IDs
    // For DMs (specified visibility), also include recipients from 'to' array
    const mentions = await this.extractMentions(
      noteObject.tag,
      actorService,
      visibility === "specified" ? noteObject.to : undefined,
    );

    // Extract hashtags
    const tags = this.extractHashtags(noteObject.tag);

    // Extract custom emojis from tags and save to database
    const emojis = this.extractEmojis(noteObject.tag);

    // Extract host from note URI for emoji storage
    let noteHost: string | null = null;
    try {
      noteHost = new URL(noteObject.id).hostname;
    } catch {
      // Ignore invalid URL
    }

    // Save remote emojis to database (fire-and-forget)
    if (noteHost && this.customEmojiRepository) {
      this.saveRemoteEmojis(noteObject.tag, noteHost).catch((err) => {
        logger.warn({ err, noteUri: noteObject.id }, "Failed to save remote emojis");
      });
    }

    // Process attachments (images, videos, etc.)
    const fileIds = await this.processAttachments(noteObject.attachment, author.id);

    // Find reply target
    let replyId: string | null = null;
    if (noteObject.inReplyTo) {
      const replyNote = await this.noteRepository.findByUri(noteObject.inReplyTo);
      replyId = replyNote?.id || null;
    }

    // Create note
    const note = await this.noteRepository.create({
      id: generateId(),
      userId: author.id,
      text,
      cw,
      visibility,
      localOnly: false, // Remote notes are never local-only
      replyId,
      renoteId: null, // Announce activities are handled separately by AnnounceHandler
      fileIds,
      mentions,
      emojis,
      tags,
      uri: noteObject.id,
      isDeleted: false,
      deletedAt: null,
      deletedById: null,
      deletionReason: null,
      // Counters use database defaults
    });

    // Increment reply count on parent note if this is a reply
    if (replyId) {
      await this.noteRepository.incrementRepliesCount(replyId);
    }

    logger.debug(
      { noteUri: noteObject.id, author: `${author.username}@${author.host}`, visibility, mentionCount: mentions.length },
      "Remote note created",
    );

    return note;
  }

  /**
   * Strip HTML tags from content
   *
   * ActivityPub notes often contain HTML markup.
   * This function strips tags while preserving text content.
   *
   * @param html - HTML content
   * @returns Plain text
   */
  private stripHtml(html: string): string {
    // Simple HTML stripping (replace <br> with newlines, remove other tags)
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Determine visibility from to/cc fields
   *
   * Maps ActivityPub addressing to local visibility levels.
   *
   * @param to - ActivityPub "to" field
   * @param cc - ActivityPub "cc" field
   * @returns Visibility level
   */
  private determineVisibility(
    to?: string | string[],
    cc?: string | string[],
  ): "public" | "home" | "followers" | "specified" {
    const toArray = Array.isArray(to) ? to : to ? [to] : [];
    const ccArray = Array.isArray(cc) ? cc : cc ? [cc] : [];

    const PUBLIC = "https://www.w3.org/ns/activitystreams#Public";
    const AS_PUBLIC = "as:Public";

    // Check if public
    if (toArray.includes(PUBLIC) || toArray.includes(AS_PUBLIC)) {
      return "public";
    }

    if (ccArray.includes(PUBLIC) || ccArray.includes(AS_PUBLIC)) {
      return "home"; // Unlisted (not in public timeline, but visible to everyone)
    }

    // If addressed to followers collection
    if (toArray.some((uri) => uri.endsWith("/followers"))) {
      return "followers";
    }

    // Direct message
    return "specified";
  }

  /**
   * Extract mention user IDs from tags
   *
   * Resolves mentioned users and returns their local IDs.
   * For each Mention tag, attempts to resolve the user URI to a local user record.
   *
   * @param tags - ActivityPub tags array
   * @param actorService - RemoteActorService for resolving user URIs
   * @returns Array of user IDs
   */
  private async extractMentions(
    tags: Array<{ type: string; name?: string; href?: string }> | undefined,
    actorService: RemoteActorService,
    dmRecipients?: string | string[],
  ): Promise<string[]> {
    const mentions: string[] = [];
    const seen = new Set<string>();

    // Extract mentions from tags
    if (tags) {
      for (const tag of tags) {
        if (tag.type === "Mention" && tag.href) {
          try {
            // Resolve mentioned user URI to local user record
            const mentionedUser = await actorService.resolveActor(tag.href);
            if (mentionedUser && !seen.has(mentionedUser.id)) {
              mentions.push(mentionedUser.id);
              seen.add(mentionedUser.id);
            }
          } catch (error) {
            // Don't fail note processing if mention resolution fails
            logger.debug({ err: error, href: tag.href }, "Failed to resolve mentioned user");
          }
        }
      }
    }

    // For DMs, also extract recipients from 'to' array
    // This ensures the local user is in mentions even if not in tag array
    if (dmRecipients) {
      const recipientArray = Array.isArray(dmRecipients) ? dmRecipients : [dmRecipients];

      for (const recipientUri of recipientArray) {
        // Skip ActivityStreams public/followers URIs
        if (
          recipientUri.includes("#Public") ||
          recipientUri.includes("as:Public") ||
          recipientUri.endsWith("/followers")
        ) {
          continue;
        }

        try {
          const recipientUser = await actorService.resolveActor(recipientUri);
          if (recipientUser && !seen.has(recipientUser.id)) {
            mentions.push(recipientUser.id);
            seen.add(recipientUser.id);
            logger.debug(
              { recipientUri, userId: recipientUser.id },
              "Added DM recipient to mentions from 'to' array",
            );
          }
        } catch (error) {
          // Don't fail note processing if recipient resolution fails
          logger.debug({ err: error, recipientUri }, "Failed to resolve DM recipient");
        }
      }
    }

    return mentions;
  }

  /**
   * Extract hashtags from tags
   *
   * @param tags - ActivityPub tags array
   * @returns Array of hashtag names (without #)
   */
  private extractHashtags(tags?: Array<{ type: string; name?: string; href?: string }>): string[] {
    if (!tags) return [];

    const hashtags: string[] = [];

    for (const tag of tags) {
      if (tag.type === "Hashtag" && tag.name) {
        // Remove # prefix if present
        const tagName = tag.name.startsWith("#") ? tag.name.slice(1) : tag.name;
        hashtags.push(tagName);
      }
    }

    return hashtags;
  }

  /**
   * Extract custom emoji names from tags
   *
   * ActivityPub Emoji tags contain the emoji name and icon URL.
   * We store the emoji names (with colons) for later rendering.
   *
   * @param tags - ActivityPub tags array
   * @returns Array of emoji names (e.g., [":blobcat:", ":heart_eyes:"])
   */
  private extractEmojis(
    tags?: Array<{ type: string; name?: string; href?: string; icon?: { url: string } }>,
  ): string[] {
    if (!tags) return [];

    const emojis: string[] = [];

    for (const tag of tags) {
      if (tag.type === "Emoji" && tag.name) {
        // Emoji names should be in :name: format
        let emojiName = tag.name;
        if (!emojiName.startsWith(":")) {
          emojiName = `:${emojiName}`;
        }
        if (!emojiName.endsWith(":")) {
          emojiName = `${emojiName}:`;
        }
        emojis.push(emojiName);
      }
    }

    return emojis;
  }

  /**
   * Save remote emojis to database
   *
   * Stores emoji metadata from ActivityPub tags for later rendering.
   * Skips emojis that already exist in the database.
   *
   * @param tags - ActivityPub tags array
   * @param host - Remote server hostname
   */
  private async saveRemoteEmojis(
    tags: Array<{ type: string; name?: string; href?: string; icon?: { url: string } }> | undefined,
    host: string,
  ): Promise<void> {
    if (!tags || !this.customEmojiRepository) return;

    for (const tag of tags) {
      if (tag.type !== "Emoji" || !tag.name || !tag.icon?.url) continue;

      // Normalize emoji name (remove colons)
      let emojiName = tag.name;
      if (emojiName.startsWith(":")) {
        emojiName = emojiName.slice(1);
      }
      if (emojiName.endsWith(":")) {
        emojiName = emojiName.slice(0, -1);
      }

      try {
        // Check if emoji already exists
        const existing = await this.customEmojiRepository.findByName(emojiName, host);

        if (existing) {
          // Update URL if it changed
          if (existing.url !== tag.icon.url) {
            await this.customEmojiRepository.update(existing.id, {
              url: tag.icon.url,
              publicUrl: tag.icon.url,
              updatedAt: new Date(),
            });
            logger.debug({ emojiName, host }, "Updated remote emoji URL");
          }
          continue;
        }

        // Create new remote emoji entry
        await this.customEmojiRepository.create({
          id: generateId(),
          name: emojiName,
          host,
          url: tag.icon.url,
          publicUrl: tag.icon.url,
          aliases: [],
          isSensitive: false,
          localOnly: false,
        });

        logger.debug({ emojiName, host, url: tag.icon.url }, "Saved remote emoji");
      } catch (error) {
        // Don't fail note processing if emoji saving fails
        logger.warn({ err: error, emojiName, host }, "Failed to save remote emoji");
      }
    }
  }

  /**
   * Process attachments from ActivityPub note
   *
   * Creates drive file entries for remote attachments.
   * Remote files are not downloaded; only metadata is stored with the original URL.
   *
   * @param attachments - ActivityPub attachment array
   * @param userId - ID of the user who authored the note
   * @returns Array of created file IDs
   */
  private async processAttachments(
    attachments: APNote["attachment"],
    userId: string,
  ): Promise<string[]> {
    if (!attachments || attachments.length === 0 || !this.driveFileRepository) {
      return [];
    }

    const fileIds: string[] = [];

    for (const attachment of attachments) {
      // Only process Document type attachments (images, videos, audio, etc.)
      if (attachment.type !== "Document" && attachment.type !== "Image" && attachment.type !== "Audio" && attachment.type !== "Video") {
        continue;
      }

      if (!attachment.url || !attachment.mediaType) {
        continue;
      }

      try {
        const fileId = generateId();

        // Extract filename from URL or use a default
        let filename = attachment.name || "attachment";
        try {
          const urlPath = new URL(attachment.url).pathname;
          const urlFilename = urlPath.split("/").pop();
          if (urlFilename) {
            filename = urlFilename;
          }
        } catch {
          // Keep default filename
        }

        // Create drive file entry for remote attachment
        // Remote files use their original URL directly (no local storage)
        await this.driveFileRepository.create({
          id: fileId,
          userId,
          folderId: null,
          name: filename,
          type: attachment.mediaType,
          size: 0, // Unknown for remote files
          md5: `remote:${attachment.url}`, // Use URL as unique identifier for remote files
          url: attachment.url, // Direct link to remote file
          thumbnailUrl: null,
          blurhash: null,
          comment: attachment.name || null,
          isSensitive: false,
          storageKey: `remote:${attachment.url}`, // Mark as remote file
          source: "system", // Remote files are system-imported
        });

        fileIds.push(fileId);
        logger.debug({ fileId, url: attachment.url, type: attachment.mediaType }, "Saved remote attachment");
      } catch (error) {
        // Don't fail note processing if attachment saving fails
        logger.warn({ err: error, url: attachment.url }, "Failed to save remote attachment");
      }
    }

    return fileIds;
  }
}
