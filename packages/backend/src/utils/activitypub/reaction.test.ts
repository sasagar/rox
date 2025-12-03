/**
 * Tests for ActivityPub reaction extraction
 */

import { describe, expect, test } from "bun:test";
import { extractReactionFromLike } from "./reaction.js";

describe("extractReactionFromLike", () => {
  test("should return heart emoji for standard ActivityPub Like", () => {
    const activity = {
      type: "Like",
      actor: "https://example.com/users/alice",
      object: "https://example.com/notes/123",
    };

    const result = extractReactionFromLike(activity);
    expect(result.reaction).toBe("❤️");
    expect(result.customEmojiUrl).toBeUndefined();
  });

  test("should extract Unicode emoji from Misskey _misskey_reaction", () => {
    const activity = {
      type: "Like",
      actor: "https://misskey.local/users/abc",
      object: "https://rox.local/notes/123",
      _misskey_reaction: "🎉",
    };

    const result = extractReactionFromLike(activity);
    expect(result.reaction).toBe("🎉");
    expect(result.customEmojiUrl).toBeUndefined();
  });

  test("should extract Unicode emoji from content field", () => {
    const activity = {
      type: "Like",
      actor: "https://misskey.local/users/abc",
      object: "https://rox.local/notes/123",
      content: "⭐",
    };

    const result = extractReactionFromLike(activity);
    expect(result.reaction).toBe("⭐");
    expect(result.customEmojiUrl).toBeUndefined();
  });

  test("should prefer _misskey_reaction over content", () => {
    const activity = {
      type: "Like",
      actor: "https://misskey.local/users/abc",
      object: "https://rox.local/notes/123",
      _misskey_reaction: "🔥",
      content: "👍",
    };

    const result = extractReactionFromLike(activity);
    expect(result.reaction).toBe("🔥");
  });

  test("should extract custom emoji with URL from tag array", () => {
    const activity = {
      type: "Like",
      actor: "https://misskey.local/users/abc",
      object: "https://rox.local/notes/123",
      _misskey_reaction: ":custom_emoji:",
      tag: [
        {
          type: "Emoji",
          name: ":custom_emoji:",
          icon: {
            type: "Image",
            url: "https://misskey.local/files/emoji.png",
          },
        },
      ],
    };

    const result = extractReactionFromLike(activity);
    expect(result.reaction).toBe(":custom_emoji:");
    expect(result.customEmojiUrl).toBe("https://misskey.local/files/emoji.png");
  });

  test("should handle custom emoji without matching tag", () => {
    const activity = {
      type: "Like",
      actor: "https://misskey.local/users/abc",
      object: "https://rox.local/notes/123",
      _misskey_reaction: ":missing_emoji:",
      tag: [],
    };

    const result = extractReactionFromLike(activity);
    expect(result.reaction).toBe(":missing_emoji:");
    expect(result.customEmojiUrl).toBeUndefined();
  });

  test("should handle custom emoji with no tag array", () => {
    const activity = {
      type: "Like",
      actor: "https://misskey.local/users/abc",
      object: "https://rox.local/notes/123",
      _misskey_reaction: ":no_tags:",
    };

    const result = extractReactionFromLike(activity);
    expect(result.reaction).toBe(":no_tags:");
    expect(result.customEmojiUrl).toBeUndefined();
  });

  test("should handle multiple tags and find correct emoji", () => {
    const activity = {
      type: "Like",
      actor: "https://misskey.local/users/abc",
      object: "https://rox.local/notes/123",
      _misskey_reaction: ":target_emoji:",
      tag: [
        {
          type: "Mention",
          href: "https://example.com/users/bob",
        },
        {
          type: "Emoji",
          name: ":other_emoji:",
          icon: {
            type: "Image",
            url: "https://misskey.local/files/other.png",
          },
        },
        {
          type: "Emoji",
          name: ":target_emoji:",
          icon: {
            type: "Image",
            url: "https://misskey.local/files/target.png",
          },
        },
      ],
    };

    const result = extractReactionFromLike(activity);
    expect(result.reaction).toBe(":target_emoji:");
    expect(result.customEmojiUrl).toBe("https://misskey.local/files/target.png");
  });

  test("should handle emoji tag without icon URL", () => {
    const activity = {
      type: "Like",
      actor: "https://misskey.local/users/abc",
      object: "https://rox.local/notes/123",
      _misskey_reaction: ":no_icon:",
      tag: [
        {
          type: "Emoji",
          name: ":no_icon:",
          icon: {
            type: "Image",
            // Missing url property
          },
        },
      ],
    };

    const result = extractReactionFromLike(activity);
    expect(result.reaction).toBe(":no_icon:");
    expect(result.customEmojiUrl).toBeUndefined();
  });
});
