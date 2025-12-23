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
      expect(response.type).toBe("rich");
      expect(response.author_name).toBe("Alice (@alice)");
      expect(response.author_url).toBe("https://example.com/@alice");
      expect(response.provider_name).toBe("Test Instance");
      expect(response.provider_url).toBe("https://example.com");
    });

    it("should use note text as title", () => {
      const response = generateNoteOEmbed(baseOptions);

      expect(response.title).toBe("Hello, world!");
    });

    it("should truncate long text in title", () => {
      const longText = "a".repeat(300);
      const response = generateNoteOEmbed({
        ...baseOptions,
        text: longText,
      });

      expect(response.title!.length).toBeLessThanOrEqual(201); // 200 + ellipsis
      expect(response.title!.endsWith("…")).toBe(true);
    });

    it("should use CW as title when present", () => {
      const response = generateNoteOEmbed({
        ...baseOptions,
        cw: "Spoiler warning",
      });

      expect(response.title).toBe("CW: Spoiler warning");
    });

    it("should handle media-only notes", () => {
      const response = generateNoteOEmbed({
        ...baseOptions,
        text: null,
      });

      expect(response.title).toBe("View this note for more details.");
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

    it("should handle remote users", () => {
      const response = generateNoteOEmbed({
        ...baseOptions,
        authorHost: "remote.social",
      });

      expect(response.author_name).toBe("Alice (@alice@remote.social)");
      expect(response.author_url).toBe("https://example.com/@alice@remote.social");
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

    it("should prefer displayName over username in author_name", () => {
      const response = generateNoteOEmbed(baseOptions);

      expect(response.author_name).toContain("Alice");
    });

    it("should use username when displayName is null", () => {
      const response = generateNoteOEmbed({
        ...baseOptions,
        authorDisplayName: null,
      });

      expect(response.author_name).toBe("alice (@alice)");
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
      expect(response.author_name).toBe("Alice (@alice)");
      expect(response.author_url).toBe("https://example.com/@alice");
      expect(response.provider_name).toBe("Test Instance");
      expect(response.provider_url).toBe("https://example.com");
    });

    it("should use bio as title", () => {
      const response = generateUserOEmbed(baseOptions);

      expect(response.title).toBe("Hello, I'm Alice!");
    });

    it("should truncate long bio in title", () => {
      const longBio = "a".repeat(300);
      const response = generateUserOEmbed({
        ...baseOptions,
        bio: longBio,
      });

      expect(response.title!.length).toBeLessThanOrEqual(201);
      expect(response.title!.endsWith("…")).toBe(true);
    });

    it("should use default title when bio is null", () => {
      const response = generateUserOEmbed({
        ...baseOptions,
        bio: null,
      });

      expect(response.title).toBe("View @alice's profile");
    });

    it("should include avatar as thumbnail", () => {
      const response = generateUserOEmbed(baseOptions);

      expect(response.thumbnail_url).toBe("https://example.com/avatar.jpg");
      expect(response.thumbnail_width).toBe(128);
      expect(response.thumbnail_height).toBe(128);
    });

    it("should handle remote users", () => {
      const response = generateUserOEmbed({
        ...baseOptions,
        host: "remote.social",
      });

      expect(response.author_name).toBe("Alice (@alice@remote.social)");
      expect(response.author_url).toBe("https://example.com/@alice@remote.social");
    });

    it("should handle missing displayName", () => {
      const response = generateUserOEmbed({
        ...baseOptions,
        displayName: null,
      });

      expect(response.author_name).toBe("@alice");
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
