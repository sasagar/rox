/**
 * ActivityPub reaction extraction utilities
 *
 * Supports extracting reactions from Like activities, including:
 * - Standard ActivityPub Like (maps to ❤️)
 * - Misskey extension with _misskey_reaction field and custom emoji in tag
 */

/**
 * Result of extracting a reaction from a Like activity
 */
export interface ExtractedReaction {
  /** The reaction string (Unicode emoji or :custom_emoji: format) */
  reaction: string;
  /** URL for custom emoji image (if available) */
  customEmojiUrl?: string;
  /** Custom emoji name without colons (if custom emoji) */
  emojiName?: string;
  /** Host of the remote server (for remote custom emojis) */
  emojiHost?: string;
}

/**
 * Extract host from an actor URI
 *
 * @param actorUri Actor URI (e.g., "https://example.com/users/alice")
 * @returns Hostname or undefined if invalid
 */
function extractHostFromUri(actorUri: string | undefined): string | undefined {
  if (!actorUri) return undefined;
  try {
    return new URL(actorUri).hostname;
  } catch {
    return undefined;
  }
}

/**
 * Extract reaction and custom emoji URL from Like activity
 *
 * Supports:
 * - Standard ActivityPub Like (maps to ❤️)
 * - Misskey extension with _misskey_reaction field and custom emoji in tag
 *
 * @param activity The Like activity object
 * @param actorUri Optional actor URI to extract host for remote emojis
 * @returns Object containing reaction string, optional custom emoji URL, name, and host
 */
export function extractReactionFromLike(activity: any, actorUri?: string): ExtractedReaction {
  // Check for Misskey extension: _misskey_reaction or content field
  const misskeyReaction = activity._misskey_reaction || activity.content;

  if (misskeyReaction && typeof misskeyReaction === "string") {
    // Check if it's a custom emoji (format: :emoji_name:)
    const customEmojiMatch = misskeyReaction.match(/^:([^:]+):$/);

    if (customEmojiMatch) {
      const emojiName = customEmojiMatch[1];
      const emojiHost = extractHostFromUri(actorUri);

      // Build reaction string with host for remote emojis
      const reactionWithHost = emojiHost ? `:${emojiName}@${emojiHost}:` : misskeyReaction;

      // Look for the emoji in the tag array
      if (Array.isArray(activity.tag)) {
        const emojiTag = activity.tag.find(
          (tag: any) =>
            tag.type === "Emoji" && (tag.name === misskeyReaction || tag.name === `:${emojiName}:`),
        );

        if (emojiTag?.icon?.url) {
          return {
            reaction: reactionWithHost,
            customEmojiUrl: emojiTag.icon.url,
            emojiName,
            emojiHost,
          };
        }
      }

      // Custom emoji without URL (fallback)
      return { reaction: reactionWithHost, emojiName, emojiHost };
    }

    // Unicode emoji from Misskey
    return { reaction: misskeyReaction };
  }

  // Standard ActivityPub Like - default to heart
  return { reaction: "❤️" };
}
