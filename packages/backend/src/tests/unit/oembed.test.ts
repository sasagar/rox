/**
 * oEmbed Generator Tests
 *
 * Tests for the oEmbed response generator functions.
 */

import { describe, it, expect } from "bun:test";
import {
  generateNoteOEmbed,
  generateUserOEmbed,
  generateOEmbedDiscoveryLink,
  type NoteOEmbedOptions,
  type UserOEmbedOptions,
} from "../../lib/oembed.js";

describe("oEmbed", () => {
  describe("generateNoteOEmbed", () => {
    const baseOptions: NoteOEmbedOptions = {
      noteId: "abc123",
      text: "Hello, world!",
      cw: null,
      authorUsername: "alice",
      authorDisplayName: "Alice",
      authorHost: null,
      authorAvatarUrl: "https://example.com/avatar.jpg",
      imageUrl: null,
      createdAt: "2024-01-01T12:00:00Z",
      baseUrl: "https://example.com",
      instanceName: "Test Instance",
      instanceIconUrl: "https://example.com/icon.png",
    };

    it("should generate valid oEmbed response with required fields", () => {
      const response = generateNoteOEmbed(baseOptions);

      expect(response.version).toBe("1.0");
      // Uses "rich" type for full author information
      expect(response.type).toBe("rich");
      // Author information with Fediverse-style ID
      expect(response.author_name).toBe("Alice (@alice@example.com)");
      expect(response.author_url).toBe("https://example.com/@alice");
      // Provider name is instance name - shows in footer
      expect(response.provider_name).toBe("Test Instance");
      expect(response.provider_url).toBe("https://example.com");
    });

    it("should include title from note text", () => {
      const response = generateNoteOEmbed(baseOptions);

      // Title from text content
      expect(response.title).toBe("Hello, world!");
    });

    it("should use content warning as title when present", () => {
      const response = generateNoteOEmbed({
        ...baseOptions,
        cw: "Sensitive content",
      });

      expect(response.title).toBe("Sensitive content");
    });

    it("should include HTML blockquote for rich rendering", () => {
      const response = generateNoteOEmbed(baseOptions);

      expect(response.html).toContain('<blockquote class="activitypub-post">');
      expect(response.html).toContain("<p>Hello, world!</p>");
      expect(response.html).toContain("Alice (@alice@example.com)");
      expect(response.html).toContain("https://example.com/@alice");
      expect(response.html).toContain("https://example.com/notes/abc123");
    });

    it("should include image thumbnail when available", () => {
      const response = generateNoteOEmbed({
        ...baseOptions,
        imageUrl: "https://example.com/image.jpg",
      });

      expect(response.thumbnail_url).toBe("https://example.com/image.jpg");
      expect(response.thumbnail_width).toBe(400);
      expect(response.thumbnail_height).toBe(300);
    });

    it("should use avatar as fallback thumbnail", () => {
      const response = generateNoteOEmbed(baseOptions);

      expect(response.thumbnail_url).toBe("https://example.com/avatar.jpg");
      expect(response.thumbnail_width).toBe(128);
      expect(response.thumbnail_height).toBe(128);
    });

    it("should include cache_age", () => {
      const response = generateNoteOEmbed(baseOptions);

      expect(response.cache_age).toBe(300);
    });

    it("should handle missing avatar", () => {
      const response = generateNoteOEmbed({
        ...baseOptions,
        authorAvatarUrl: null,
      });

      expect(response.thumbnail_url).toBeUndefined();
    });

  });

  describe("generateUserOEmbed", () => {
    const baseOptions: UserOEmbedOptions = {
      username: "alice",
      displayName: "Alice",
      bio: "Hello, I'm Alice!",
      host: null,
      avatarUrl: "https://example.com/avatar.jpg",
      baseUrl: "https://example.com",
      instanceName: "Test Instance",
      instanceIconUrl: "https://example.com/icon.png",
    };

    it("should generate valid oEmbed response with required fields", () => {
      const response = generateUserOEmbed(baseOptions);

      expect(response.version).toBe("1.0");
      expect(response.type).toBe("rich");
      // Author information with Fediverse-style ID
      expect(response.author_name).toBe("Alice (@alice@example.com)");
      expect(response.author_url).toBe("https://example.com/@alice");
      // Provider name is instance name - shows in footer
      expect(response.provider_name).toBe("Test Instance");
      expect(response.provider_url).toBe("https://example.com");
    });

    it("should include title from display name", () => {
      const response = generateUserOEmbed(baseOptions);

      expect(response.title).toBe("Alice");
    });

    it("should include HTML blockquote with bio", () => {
      const response = generateUserOEmbed(baseOptions);

      expect(response.html).toContain('<blockquote class="activitypub-profile">');
      // escapeHtml uses &#039; for apostrophe
      expect(response.html).toContain("<p>Hello, I&#039;m Alice!</p>");
      expect(response.html).toContain("Alice (@alice@example.com)");
      expect(response.html).toContain("https://example.com/@alice");
    });

    it("should include avatar as thumbnail", () => {
      const response = generateUserOEmbed(baseOptions);

      expect(response.thumbnail_url).toBe("https://example.com/avatar.jpg");
      expect(response.thumbnail_width).toBe(128);
      expect(response.thumbnail_height).toBe(128);
    });


    it("should handle missing avatar", () => {
      const response = generateUserOEmbed({
        ...baseOptions,
        avatarUrl: null,
      });

      expect(response.thumbnail_url).toBeUndefined();
    });

    it("should include cache_age", () => {
      const response = generateUserOEmbed(baseOptions);

      expect(response.cache_age).toBe(300);
    });
  });

  describe("generateOEmbedDiscoveryLink", () => {
    it("should generate valid link tag", () => {
      const link = generateOEmbedDiscoveryLink(
        "https://example.com/oembed?url=https://example.com/notes/abc123"
      );

      expect(link).toContain('rel="alternate"');
      expect(link).toContain('type="application/json+oembed"');
      expect(link).toContain('href="https://example.com/oembed?url=https://example.com/notes/abc123"');
      expect(link).toContain('title="oEmbed"');
    });

    it("should escape special characters in URL", () => {
      const link = generateOEmbedDiscoveryLink(
        'https://example.com/oembed?url=https://example.com/notes/abc&foo="bar"'
      );

      expect(link).toContain("&amp;");
      expect(link).toContain("&quot;");
    });
  });
});
