import { describe, it, expect } from "bun:test";
import {
  escapeHtml,
  truncateText,
  stripHtml,
  generateNoteOgpHtml,
  generateUserOgpHtml,
} from "../../lib/ogp.js";

describe("ogp utilities", () => {
  describe("escapeHtml", () => {
    it("should escape ampersand", () => {
      expect(escapeHtml("foo & bar")).toBe("foo &amp; bar");
    });

    it("should escape less than", () => {
      expect(escapeHtml("foo < bar")).toBe("foo &lt; bar");
    });

    it("should escape greater than", () => {
      expect(escapeHtml("foo > bar")).toBe("foo &gt; bar");
    });

    it("should escape double quotes", () => {
      expect(escapeHtml('foo "bar"')).toBe("foo &quot;bar&quot;");
    });

    it("should escape single quotes", () => {
      expect(escapeHtml("foo 'bar'")).toBe("foo &#039;bar&#039;");
    });

    it("should escape multiple special characters", () => {
      expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
        "&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;"
      );
    });

    it("should handle empty string", () => {
      expect(escapeHtml("")).toBe("");
    });
  });

  describe("truncateText", () => {
    it("should not truncate short text", () => {
      expect(truncateText("Hello", 200)).toBe("Hello");
    });

    it("should truncate long text with ellipsis", () => {
      const longText = "a".repeat(250);
      const result = truncateText(longText, 200);
      expect(result.length).toBe(200);
      expect(result.endsWith("…")).toBe(true);
    });

    it("should use default max length of 200", () => {
      const longText = "a".repeat(250);
      const result = truncateText(longText);
      expect(result.length).toBe(200);
    });

    it("should handle exact length text", () => {
      const text = "a".repeat(200);
      expect(truncateText(text, 200)).toBe(text);
    });

    it("should trim trailing whitespace before ellipsis", () => {
      const text = "Hello world    extra text here that exceeds limit";
      const result = truncateText(text, 15);
      // trimEnd() removes trailing spaces, so "Hello world   " becomes "Hello world"
      expect(result).toBe("Hello world…");
    });
  });

  describe("stripHtml", () => {
    it("should strip simple HTML tags", () => {
      expect(stripHtml("<p>Hello</p>")).toBe("Hello");
    });

    it("should strip nested HTML tags", () => {
      expect(stripHtml("<div><p><strong>Hello</strong></p></div>")).toBe(
        "Hello"
      );
    });

    it("should strip self-closing tags", () => {
      expect(stripHtml("Hello<br/>World")).toBe("HelloWorld");
    });

    it("should handle empty string", () => {
      expect(stripHtml("")).toBe("");
    });

    it("should trim whitespace", () => {
      expect(stripHtml("  <p>Hello</p>  ")).toBe("Hello");
    });

    it("should preserve text without HTML", () => {
      expect(stripHtml("Hello World")).toBe("Hello World");
    });
  });
});

describe("generateNoteOgpHtml", () => {
  const baseOptions = {
    noteId: "abc123",
    text: "Hello, world!",
    cw: null,
    authorUsername: "alice",
    authorDisplayName: "Alice",
    authorHost: null,
    imageUrl: null,
    baseUrl: "https://example.com",
    instanceName: "My Instance",
    themeColor: "#3b82f6",
  };

  it("should generate valid HTML with OGP meta tags", () => {
    const html = generateNoteOgpHtml(baseOptions);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<meta property="og:description"');
    expect(html).toContain('<meta property="og:url"');
    expect(html).toContain('<meta property="og:type" content="article">');
    // FxTwitter-style: no og:site_name, use oEmbed provider_name instead
    expect(html).not.toContain('<meta property="og:site_name"');
    // FxTwitter-style: no twitter:card to let oEmbed control display
    expect(html).not.toContain('twitter:card');
    expect(html).toContain('<meta name="theme-color"');
    // Standard HTML description meta tag
    expect(html).toContain('<meta name="description"');
  });

  it("should not include twitter:card (FxTwitter-style for oEmbed control)", () => {
    const html = generateNoteOgpHtml(baseOptions);
    // FxTwitter removes twitter:card to let oEmbed control the embed display
    expect(html).not.toContain('twitter:card');
  });

  it("should not include og:site_name (FxTwitter-style for oEmbed footer)", () => {
    const html = generateNoteOgpHtml(baseOptions);
    // FxTwitter-style: remove og:site_name so Discord uses oEmbed provider_name for footer
    expect(html).not.toContain('og:site_name');
  });

  it("should not include redundant Twitter Card tags", () => {
    const html = generateNoteOgpHtml(baseOptions);
    // Misskey doesn't include these redundant tags
    expect(html).not.toContain('<meta name="twitter:title"');
    expect(html).not.toContain('<meta name="twitter:description"');
    expect(html).not.toContain('<meta name="twitter:site"');
    expect(html).not.toContain('<meta name="twitter:image"');
  });

  it("should not include og:locale or article:* tags", () => {
    const html = generateNoteOgpHtml(baseOptions);
    // Misskey doesn't include these extra tags
    expect(html).not.toContain('og:locale');
    expect(html).not.toContain('article:published_time');
    expect(html).not.toContain('article:author');
  });

  it("should include note URL in og:url", () => {
    const html = generateNoteOgpHtml(baseOptions);
    expect(html).toContain('content="https://example.com/notes/abc123"');
  });

  it("should not include refresh meta tag (Discord compatibility)", () => {
    const html = generateNoteOgpHtml(baseOptions);
    // Refresh meta tag can cause Discord to follow redirect and miss OGP
    expect(html).not.toContain('http-equiv="refresh"');
  });

  it("should include author username in title", () => {
    const html = generateNoteOgpHtml(baseOptions);
    expect(html).toContain("Alice (@alice)");
  });

  it("should handle remote user (with host)", () => {
    const html = generateNoteOgpHtml({
      ...baseOptions,
      authorHost: "mastodon.social",
    });
    expect(html).toContain("@alice@mastodon.social");
  });

  it("should use username as display name fallback", () => {
    const html = generateNoteOgpHtml({
      ...baseOptions,
      authorDisplayName: null,
    });
    expect(html).toContain("alice (@alice)");
  });

  it("should include og:image when imageUrl is provided", () => {
    const html = generateNoteOgpHtml({
      ...baseOptions,
      imageUrl: "https://example.com/image.jpg",
    });
    expect(html).toContain(
      '<meta property="og:image" content="https://example.com/image.jpg">'
    );
  });

  it("should not include og:image when imageUrl is null", () => {
    const html = generateNoteOgpHtml(baseOptions);
    expect(html).not.toContain('<meta property="og:image"');
  });

  it("should not include twitter:card (FxTwitter-style)", () => {
    const html = generateNoteOgpHtml(baseOptions);
    // FxTwitter removes twitter:card to let oEmbed control the embed display
    expect(html).not.toContain('twitter:card');
  });

  it("should not include twitter:card even with image (FxTwitter-style)", () => {
    const html = generateNoteOgpHtml({
      ...baseOptions,
      imageUrl: "https://example.com/image.jpg",
    });
    // FxTwitter removes twitter:card to let oEmbed control the embed display
    expect(html).not.toContain('twitter:card');
  });

  it("should include oEmbed discovery link for Discord footer", () => {
    const html = generateNoteOgpHtml(baseOptions);
    // oEmbed discovery link enables Discord to fetch provider_name for footer
    // FxTwitter uses this pattern to show site name in footer
    expect(html).toContain('application/json+oembed');
    expect(html).toContain('rel="alternate"');
    expect(html).toContain('/oembed?url=');
  });

  it("should handle content warning", () => {
    const html = generateNoteOgpHtml({
      ...baseOptions,
      cw: "Spoiler alert!",
    });
    // CW is shown in description with warning indicator
    expect(html).toContain("CW: Spoiler alert!");
    // Title is author name (FxTwitter style)
    expect(html).toContain("Alice (@alice)");
  });

  it("should handle note without text (media only)", () => {
    const html = generateNoteOgpHtml({
      ...baseOptions,
      text: null,
    });
    // Title is author name, description indicates media
    expect(html).toContain("Alice (@alice)");
    expect(html).toContain("Media attached");
  });

  it("should escape HTML in note text", () => {
    const html = generateNoteOgpHtml({
      ...baseOptions,
      text: '<script>alert("XSS")</script>',
    });
    // HTML tags are stripped first by stripHtml(), then XSS characters are escaped
    expect(html).not.toContain("<script>");
    // The text content after stripping HTML is: alert("XSS")
    // Which gets escaped to: alert(&quot;XSS&quot;)
    expect(html).toContain("alert(&quot;XSS&quot;)");
  });

  it("should generate HTML under 32KB (Slack limit)", () => {
    const html = generateNoteOgpHtml({
      ...baseOptions,
      text: "a".repeat(5000), // Long text
    });
    expect(new Blob([html]).size).toBeLessThan(32 * 1024);
  });
});

describe("generateUserOgpHtml", () => {
  const baseOptions = {
    username: "alice",
    displayName: "Alice",
    bio: "Hello, I'm Alice!",
    host: null,
    avatarUrl: "https://example.com/avatar.jpg",
    baseUrl: "https://example.com",
    instanceName: "My Instance",
    themeColor: "#3b82f6",
  };

  it("should generate valid HTML with OGP meta tags", () => {
    const html = generateUserOgpHtml(baseOptions);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<meta property="og:title"');
    expect(html).toContain('<meta property="og:description"');
    expect(html).toContain('<meta property="og:url"');
    expect(html).toContain('<meta property="og:type" content="blog">');
    // FxTwitter-style: no og:site_name, use oEmbed provider_name instead
    expect(html).not.toContain('<meta property="og:site_name"');
    // FxTwitter-style: no twitter:card to let oEmbed control display
    expect(html).not.toContain('twitter:card');
    expect(html).toContain('<meta name="theme-color"');
    // Standard HTML description meta tag
    expect(html).toContain('<meta name="description"');
  });

  it("should not include twitter:card (FxTwitter-style for oEmbed control)", () => {
    const html = generateUserOgpHtml(baseOptions);
    // FxTwitter removes twitter:card to let oEmbed control the embed display
    expect(html).not.toContain('twitter:card');
  });

  it("should not include og:site_name (FxTwitter-style for oEmbed footer)", () => {
    const html = generateUserOgpHtml(baseOptions);
    // FxTwitter-style: remove og:site_name so Discord uses oEmbed provider_name for footer
    expect(html).not.toContain('og:site_name');
  });

  it("should not include redundant Twitter Card tags", () => {
    const html = generateUserOgpHtml(baseOptions);
    // Misskey doesn't include these redundant tags
    expect(html).not.toContain('<meta name="twitter:title"');
    expect(html).not.toContain('<meta name="twitter:description"');
    expect(html).not.toContain('<meta name="twitter:site"');
    expect(html).not.toContain('<meta name="twitter:image"');
  });

  it("should not include og:locale or profile:* tags", () => {
    const html = generateUserOgpHtml(baseOptions);
    // Misskey doesn't include these extra tags
    expect(html).not.toContain('og:locale');
    expect(html).not.toContain('profile:username');
  });

  it("should not include og:image dimension tags", () => {
    const html = generateUserOgpHtml(baseOptions);
    // Minimal approach - no og:image:alt, og:image:width, og:image:height
    expect(html).not.toContain('og:image:alt');
    expect(html).not.toContain('og:image:width');
    expect(html).not.toContain('og:image:height');
  });

  it("should include profile URL in og:url", () => {
    const html = generateUserOgpHtml(baseOptions);
    expect(html).toContain('content="https://example.com/@alice"');
  });

  it("should not include refresh meta tag (Discord compatibility)", () => {
    const html = generateUserOgpHtml(baseOptions);
    // Refresh meta tag can cause Discord to follow redirect and miss OGP
    expect(html).not.toContain('http-equiv="refresh"');
  });

  it("should include display name and username in title", () => {
    const html = generateUserOgpHtml(baseOptions);
    expect(html).toContain("Alice (@alice)");
  });

  it("should handle remote user (with host)", () => {
    const html = generateUserOgpHtml({
      ...baseOptions,
      host: "mastodon.social",
    });
    expect(html).toContain("@alice@mastodon.social");
    expect(html).toContain("https://example.com/@alice@mastodon.social");
  });

  it("should use username as display name fallback", () => {
    const html = generateUserOgpHtml({
      ...baseOptions,
      displayName: null,
    });
    expect(html).toContain("@alice");
  });

  it("should include og:image when avatarUrl is provided", () => {
    const html = generateUserOgpHtml(baseOptions);
    expect(html).toContain(
      '<meta property="og:image" content="https://example.com/avatar.jpg">'
    );
  });

  it("should not include og:image when avatarUrl is null", () => {
    const html = generateUserOgpHtml({
      ...baseOptions,
      avatarUrl: null,
    });
    expect(html).not.toContain('<meta property="og:image"');
  });

  it("should include bio in description", () => {
    const html = generateUserOgpHtml(baseOptions);
    expect(html).toContain("Hello, I&#039;m Alice!");
  });

  it("should handle user without bio", () => {
    const html = generateUserOgpHtml({
      ...baseOptions,
      bio: null,
    });
    expect(html).toContain("View @alice&#039;s profile");
  });

  it("should escape HTML in bio", () => {
    const html = generateUserOgpHtml({
      ...baseOptions,
      bio: '<script>alert("XSS")</script>',
    });
    expect(html).not.toContain("<script>");
  });

  it("should generate HTML under 32KB (Slack limit)", () => {
    const html = generateUserOgpHtml({
      ...baseOptions,
      bio: "a".repeat(5000), // Long bio
    });
    expect(new Blob([html]).size).toBeLessThan(32 * 1024);
  });
});
