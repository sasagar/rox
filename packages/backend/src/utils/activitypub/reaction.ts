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
}

/**
 * Extract reaction and custom emoji URL from Like activity
 *
 * Supports:
 * - Standard ActivityPub Like (maps to ❤️)
 * - Misskey extension with _misskey_reaction field and custom emoji in tag
 *
 * @param activity The Like activity object
 * @returns Object containing reaction string and optional custom emoji URL
 */
export function extractReactionFromLike(activity: any): ExtractedReaction {
  // Check for Misskey extension: _misskey_reaction or content field
  const misskeyReaction = activity._misskey_reaction || activity.content;

  if (misskeyReaction && typeof misskeyReaction === "string") {
    // Check if it's a custom emoji (format: :emoji_name:)
    const customEmojiMatch = misskeyReaction.match(/^:([^:]+):$/);

    if (customEmojiMatch) {
      const emojiName = customEmojiMatch[1];

      // Look for the emoji in the tag array
      if (Array.isArray(activity.tag)) {
        const emojiTag = activity.tag.find(
          (tag: any) =>
            tag.type === "Emoji" && (tag.name === misskeyReaction || tag.name === `:${emojiName}:`),
        );

        if (emojiTag?.icon?.url) {
          return {
            reaction: misskeyReaction,
            customEmojiUrl: emojiTag.icon.url,
          };
        }
      }

      // Custom emoji without URL (fallback)
      return { reaction: misskeyReaction };
    }

    // Unicode emoji from Misskey
    return { reaction: misskeyReaction };
  }

  // Standard ActivityPub Like - default to heart
  return { reaction: "❤️" };
}
