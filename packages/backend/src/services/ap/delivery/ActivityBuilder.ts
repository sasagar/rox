/**
 * ActivityPub Activity Builder
 *
 * Provides a fluent interface for constructing ActivityPub activities.
 * Reduces duplication across delivery methods.
 *
 * @module services/ap/delivery/ActivityBuilder
 */

import type { Note } from "../../../../../shared/src/types/note.js";
import type { User } from "../../../../../shared/src/types/user.js";
import { logger } from "../../../lib/logger.js";

/**
 * Base ActivityPub activity structure
 */
export interface Activity {
  "@context": string | string[] | (string | Record<string, string>)[];
  type: string;
  id: string;
  actor: string;
  object?: unknown;
  target?: string;
  published?: string;
  to?: string[];
  cc?: string[];
}

/**
 * Custom emoji tag for ActivityPub
 */
export interface EmojiTag {
  type: "Emoji";
  name: string;
  icon: {
    type: "Image";
    mediaType: string;
    url: string;
  };
}

/**
 * Mention tag for ActivityPub
 */
export interface MentionTag {
  type: "Mention";
  href: string;
  name: string;
}

/**
 * ActivityPub Note object structure
 */
export interface NoteObject {
  id: string;
  type: "Note";
  attributedTo: string;
  content: string;
  published: string;
  to: string[];
  cc: string[];
  inReplyTo?: string | null;
  attachment?: unknown[];
  tag?: (EmojiTag | MentionTag)[];
  sensitive?: boolean;
  summary?: string | null;
  // Misskey extension: original MFM source text
  _misskey_content?: string;
  // ActivityPub source for plain text content
  source?: {
    content: string;
    mediaType: string;
  };
}

/**
 * Actor object for Update activities
 */
export interface ActorObject {
  "@context": (string | Record<string, unknown>)[];
  type: "Person";
  id: string;
  preferredUsername: string;
  name?: string;
  summary?: string;
  inbox: string;
  outbox: string;
  followers: string;
  following: string;
  publicKey: {
    id: string;
    owner: string;
    publicKeyPem: string;
  };
  icon?: { type: "Image"; url: string };
  image?: { type: "Image"; url: string };
}

const AS_CONTEXT = "https://www.w3.org/ns/activitystreams";
const SECURITY_CONTEXT = "https://w3id.org/security/v1";
const AS_PUBLIC = "https://www.w3.org/ns/activitystreams#Public";

/**
 * Misskey-compatible extension context for Like activities
 * Defines _misskey_reaction and Emoji types for custom emoji reactions
 */
const MISSKEY_LIKE_CONTEXT = {
  misskey: "https://misskey-hub.net/ns#",
  _misskey_reaction: "misskey:_misskey_reaction",
  toot: "http://joinmastodon.org/ns#",
  Emoji: "toot:Emoji",
};

/**
 * Custom emoji info for Like activity
 */
export interface CustomEmojiInfo {
  /** Emoji name (without colons) */
  name: string;
  /** URL to the emoji image */
  url: string;
  /** Host of the remote server (for remote custom emojis, null/undefined for local) */
  host?: string | null;
}

/**
 * Detect media type from URL extension
 */
function getMediaTypeFromUrl(url: string): string {
  const extension = url.split(".").pop()?.toLowerCase().split("?")[0];
  switch (extension) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "gif":
      return "image/gif";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "avif":
      return "image/avif";
    default:
      return "image/png"; // Default fallback
  }
}

/**
 * ActivityPub Activity Builder
 *
 * Provides helper methods for constructing common ActivityPub activities.
 */
export class ActivityBuilder {
  private readonly baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.URL || "http://localhost:3000";
  }

  /**
   * Get actor URI for a local user
   */
  actorUri(username: string): string {
    return `${this.baseUrl}/users/${username}`;
  }

  /**
   * Get key ID for HTTP signatures
   */
  keyId(username: string): string {
    return `${this.baseUrl}/users/${username}#main-key`;
  }

  /**
   * Get followers collection URI
   */
  followersUri(username: string): string {
    return `${this.baseUrl}/users/${username}/followers`;
  }

  /**
   * Generate a unique activity ID
   */
  activityId(type: string, ...parts: (string | number)[]): string {
    const path = parts.join("/");
    return `${this.baseUrl}/activities/${type.toLowerCase()}/${path}`;
  }

  /**
   * Build a Create activity for a note
   *
   * @param note - The note to create an activity for
   * @param author - The author of the note
   * @param emojiTags - Optional array of custom emoji tags to include
   */
  createNote(note: Note, author: User, emojiTags?: EmojiTag[]): Activity {
    const actorUri = this.actorUri(author.username);
    const followersUri = this.followersUri(author.username);
    const published = note.createdAt.toISOString();

    // Convert MFM text to HTML for content field
    const htmlContent = note.text ? this.textToHtml(note.text) : "";

    const noteObject: NoteObject = {
      id: note.uri || `${this.baseUrl}/notes/${note.id}`,
      type: "Note",
      attributedTo: actorUri,
      content: htmlContent,
      published,
      to: [AS_PUBLIC],
      cc: [followersUri],
      // Include original MFM source for Misskey-compatible servers
      _misskey_content: note.text || undefined,
      source: note.text
        ? {
            content: note.text,
            mediaType: "text/x.misskeymarkdown",
          }
        : undefined,
    };

    // Add emoji tags if provided
    if (emojiTags && emojiTags.length > 0) {
      noteObject.tag = emojiTags;
    }

    // Add optional fields
    if (note.cw) {
      noteObject.sensitive = true;
      noteObject.summary = note.cw;
    }
    if (note.replyId) {
      noteObject.inReplyTo = note.replyId;
    }

    return {
      "@context": AS_CONTEXT,
      type: "Create",
      id: this.activityId("create", note.id),
      actor: actorUri,
      published,
      to: [AS_PUBLIC],
      cc: [followersUri],
      object: noteObject,
    };
  }

  /**
   * Build a Like activity with optional reaction content
   *
   * Supports Misskey-compatible _misskey_reaction extension for custom emoji.
   * When a reaction is provided, it's included in both content and _misskey_reaction fields.
   * For custom emojis, an Emoji tag is included with the image URL.
   *
   * @param noteId - ID of the note being reacted to
   * @param noteUri - ActivityPub URI of the note
   * @param reactor - User creating the reaction
   * @param reaction - Optional reaction emoji (e.g., "👍", ":custom_emoji:")
   * @param customEmoji - Optional custom emoji info (name and URL)
   */
  like(
    noteId: string,
    noteUri: string,
    reactor: User,
    reaction?: string,
    customEmoji?: CustomEmojiInfo,
  ): Activity {
    // Use extended context with Misskey-compatible _misskey_reaction definition
    // This ensures remote Misskey instances properly recognize the reaction emoji
    const context: (string | Record<string, string>)[] = [AS_CONTEXT, SECURITY_CONTEXT, MISSKEY_LIKE_CONTEXT];

    const activity: Activity & {
      content?: string;
      _misskey_reaction?: string;
      tag?: unknown[];
    } = {
      "@context": context,
      type: "Like",
      id: this.activityId("like", noteId, Date.now()),
      actor: this.actorUri(reactor.username),
      object: noteUri,
    };

    // Include reaction content for Misskey compatibility
    // Misskey extracts reaction from: activity._misskey_reaction ?? activity.content ?? activity.name
    // For remote emojis, Misskey expects format :name@host: to match the original reaction
    if (reaction) {
      // Check if this is a custom emoji with a remote host
      // If so, format as :name@host: for Misskey compatibility
      let formattedReaction = reaction;
      if (customEmoji?.host) {
        // Remote emoji: format as :name@host:
        formattedReaction = `:${customEmoji.name}@${customEmoji.host}:`;
      }
      activity.content = formattedReaction;
      activity._misskey_reaction = formattedReaction;
    }

    // Add Emoji tag for custom emojis (Misskey compatible format)
    if (customEmoji) {
      // For remote emojis, include host in the name field
      const tagName = customEmoji.host
        ? `:${customEmoji.name}@${customEmoji.host}:`
        : `:${customEmoji.name}:`;

      activity.tag = [
        {
          type: "Emoji",
          id: `${this.baseUrl}/emojis/${customEmoji.name}`,
          name: tagName,
          updated: new Date().toISOString(),
          icon: {
            type: "Image",
            mediaType: getMediaTypeFromUrl(customEmoji.url),
            url: customEmoji.url,
          },
        },
      ];
    }

    logger.debug({ activity }, "Built Like activity");
    return activity;
  }

  /**
   * Build a Follow activity
   */
  follow(follower: User, followeeUri: string): Activity {
    return {
      "@context": AS_CONTEXT,
      type: "Follow",
      id: this.activityId("follow", follower.id, Date.now()),
      actor: this.actorUri(follower.username),
      object: followeeUri,
    };
  }

  /**
   * Build an Undo activity wrapping another activity
   */
  undo(originalActivity: Activity, actor: User): Activity {
    return {
      "@context": AS_CONTEXT,
      type: "Undo",
      id: this.activityId("undo", Date.now()),
      actor: this.actorUri(actor.username),
      object: originalActivity,
    };
  }

  /**
   * Build an Undo Follow activity
   */
  undoFollow(follower: User, followeeUri: string, originalFollowId?: string): Activity {
    const followActivity: Activity = {
      "@context": AS_CONTEXT,
      type: "Follow",
      id: originalFollowId || this.activityId("follow", follower.id, "original"),
      actor: this.actorUri(follower.username),
      object: followeeUri,
    };

    return this.undo(followActivity, follower);
  }

  /**
   * Build an Undo Like activity
   */
  undoLike(noteId: string, noteUri: string, reactor: User): Activity {
    const likeActivity: Activity = {
      "@context": AS_CONTEXT,
      type: "Like",
      id: this.activityId("like", noteId, "original"),
      actor: this.actorUri(reactor.username),
      object: noteUri,
    };

    return this.undo(likeActivity, reactor);
  }

  /**
   * Build a Delete activity for a note
   */
  delete(objectUri: string, actor: User): Activity {
    return {
      "@context": AS_CONTEXT,
      type: "Delete",
      id: this.activityId("delete", Date.now()),
      actor: this.actorUri(actor.username),
      object: {
        id: objectUri,
        type: "Tombstone",
      },
    };
  }

  /**
   * Build a Delete activity for an actor (account deletion)
   *
   * When an actor is deleted, the Delete activity should have:
   * - actor: the actor being deleted
   * - object: the actor URI (not a Tombstone, as the actor itself is the object)
   *
   * Some implementations expect just the URI, others expect a Tombstone.
   * Using just the URI is more common for actor deletions.
   */
  deleteActor(actor: User): Activity {
    const actorUri = this.actorUri(actor.username);
    return {
      "@context": AS_CONTEXT,
      type: "Delete",
      id: this.activityId("delete", actor.id, Date.now()),
      actor: actorUri,
      object: actorUri,
      to: [AS_PUBLIC],
    };
  }

  /**
   * Build an Update activity for an actor
   */
  updateActor(actor: User): Activity {
    const actorUri = this.actorUri(actor.username);

    const actorObject: ActorObject = {
      "@context": [
        AS_CONTEXT,
        "https://w3id.org/security/v1",
        { manuallyApprovesFollowers: "as:manuallyApprovesFollowers" },
      ],
      type: "Person",
      id: actorUri,
      preferredUsername: actor.username,
      name: actor.displayName || actor.username,
      summary: actor.bio || "",
      inbox: `${actorUri}/inbox`,
      outbox: `${actorUri}/outbox`,
      followers: this.followersUri(actor.username),
      following: `${actorUri}/following`,
      publicKey: {
        id: this.keyId(actor.username),
        owner: actorUri,
        publicKeyPem: actor.publicKey || "",
      },
    };

    // Add avatar if present
    if (actor.avatarUrl) {
      actorObject.icon = { type: "Image", url: actor.avatarUrl };
    }

    // Add banner if present
    if (actor.bannerUrl) {
      actorObject.image = { type: "Image", url: actor.bannerUrl };
    }

    return {
      "@context": AS_CONTEXT,
      type: "Update",
      id: this.activityId("update", actor.id, Date.now()),
      actor: actorUri,
      object: actorObject,
      to: [AS_PUBLIC],
    };
  }

  /**
   * Build an Announce activity (boost/renote)
   */
  announce(noteId: string, targetNoteUri: string, actor: User): Activity {
    return {
      "@context": AS_CONTEXT,
      type: "Announce",
      id: this.activityId("announce", noteId),
      actor: this.actorUri(actor.username),
      object: targetNoteUri,
      published: new Date().toISOString(),
      to: [AS_PUBLIC],
      cc: [this.followersUri(actor.username)],
    };
  }

  /**
   * Build a Create activity for a direct message
   *
   * Direct messages use specific addressing:
   * - to: list of recipient actor URIs (no public addressing)
   * - cc: empty (no followers)
   * - tag: Mention tags for each recipient (required for proper DM delivery)
   *
   * @param note - The direct message note
   * @param author - The note author
   * @param recipients - List of remote recipient users
   */
  createDirectMessage(note: Note, author: User, recipients: User[]): Activity {
    const actorUri = this.actorUri(author.username);
    const published = note.createdAt.toISOString();

    // Build recipient URIs and mention tags
    const recipientUris: string[] = [];
    const mentionTags: Array<{ type: "Mention"; href: string; name: string }> = [];

    for (const r of recipients) {
      const uri = r.uri || `https://${r.host}/users/${r.username}`;
      recipientUris.push(uri);

      // Add Mention tag for each recipient (required for DM delivery)
      mentionTags.push({
        type: "Mention",
        href: uri,
        name: `@${r.username}@${r.host}`,
      });
    }

    // Convert plain text to simple HTML (escape special characters and wrap in <p>)
    const htmlContent = this.textToHtml(note.text || "");

    const noteObject: NoteObject = {
      id: note.uri || `${this.baseUrl}/notes/${note.id}`,
      type: "Note",
      attributedTo: actorUri,
      content: htmlContent,
      published,
      to: recipientUris,
      cc: [],
      tag: mentionTags,
    };

    // Add optional fields
    if (note.cw) {
      noteObject.sensitive = true;
      noteObject.summary = note.cw;
    }
    if (note.replyId) {
      noteObject.inReplyTo = note.replyId;
    }

    return {
      "@context": AS_CONTEXT,
      type: "Create",
      id: this.activityId("create", note.id),
      actor: actorUri,
      published,
      to: recipientUris,
      cc: [],
      object: noteObject,
    };
  }

  /**
   * Convert plain text to simple HTML for ActivityPub content
   *
   * Escapes HTML special characters and wraps in <p> tags.
   * Converts newlines to <br> tags.
   */
  private textToHtml(text: string): string {
    if (!text) return "<p></p>";

    // Escape HTML special characters
    const escaped = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

    // Convert newlines to <br> and wrap in <p>
    return `<p>${escaped.replace(/\n/g, "<br>")}</p>`;
  }
}

/**
 * Get a singleton ActivityBuilder instance
 */
let builderInstance: ActivityBuilder | null = null;

export function getActivityBuilder(): ActivityBuilder {
  if (!builderInstance) {
    builderInstance = new ActivityBuilder();
  }
  return builderInstance;
}

/**
 * Reset builder instance (for testing)
 */
export function resetActivityBuilder(): void {
  builderInstance = null;
}
