/**
 * HTML to Text/MFM utilities
 *
 * Converts HTML content (from ActivityPub summaries) to plain text or MFM-compatible format.
 * This is needed because remote servers (Mastodon, GoToSocial, etc.) send bio/summary as HTML.
 */

/**
 * Check if a string contains HTML tags
 */
export function containsHtml(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Convert HTML to plain text
 * Strips all HTML tags and decodes HTML entities
 *
 * @param html - HTML string to convert
 * @returns Plain text string
 */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  if (!containsHtml(html)) return html;

  // Create a temporary element to parse HTML (browser environment)
  if (typeof document !== "undefined") {
    const temp = document.createElement("div");
    temp.innerHTML = html;

    // Convert <br> and block elements to newlines
    temp.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    temp.querySelectorAll("p, div").forEach((el) => {
      el.prepend(document.createTextNode("\n"));
      el.append(document.createTextNode("\n"));
    });

    // Get text content and clean up multiple newlines
    return (temp.textContent || "").replace(/\n{3,}/g, "\n\n").trim();
  }

  // Server-side fallback: basic regex-based HTML stripping
  return (
    html
      // Convert <br> to newlines
      .replace(/<br\s*\/?>/gi, "\n")
      // Convert </p> and </div> to double newlines
      .replace(/<\/(p|div)>/gi, "\n\n")
      // Remove all other HTML tags
      .replace(/<[^>]+>/g, "")
      // Decode common HTML entities
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&#x2F;/gi, "/")
      // Clean up multiple newlines
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  );
}

/**
 * Convert HTML to MFM-compatible text
 * Converts common HTML formatting to MFM equivalents
 *
 * @param html - HTML string to convert
 * @returns MFM-compatible text string
 */
export function htmlToMfm(html: string): string {
  if (!html) return "";
  if (!containsHtml(html)) return html;

  let result = html;

  // Convert links: <a href="url">text</a> -> [text](url)
  result = result.replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi, "[$2]($1)");

  // Convert bold: <strong>, <b> -> **text**
  result = result.replace(/<(strong|b)>([^<]*)<\/\1>/gi, "**$2**");

  // Convert italic: <em>, <i> -> *text*
  result = result.replace(/<(em|i)>([^<]*)<\/\1>/gi, "*$2*");

  // Convert strikethrough: <del>, <s>, <strike> -> ~~text~~
  result = result.replace(/<(del|s|strike)>([^<]*)<\/\1>/gi, "~~$2~~");

  // Convert code: <code> -> `text`
  result = result.replace(/<code>([^<]*)<\/code>/gi, "`$1`");

  // Convert <br> to newlines
  result = result.replace(/<br\s*\/?>/gi, "\n");

  // Convert </p> and </div> to double newlines
  result = result.replace(/<\/(p|div)>/gi, "\n\n");

  // Convert mentions: <span class="h-card"><a href="...">@user</a></span> -> @user
  result = result.replace(
    /<span[^>]*class="[^"]*h-card[^"]*"[^>]*><a[^>]*>(@[^<]+)<\/a><\/span>/gi,
    "$1",
  );

  // Convert hashtags: <a href="..." class="hashtag">#tag</a> -> #tag
  result = result.replace(/<a[^>]*class="[^"]*hashtag[^"]*"[^>]*>(#[^<]+)<\/a>/gi, "$1");

  // Remove remaining HTML tags
  result = result.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  result = result
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, "/");

  // Clean up multiple newlines
  result = result.replace(/\n{3,}/g, "\n\n").trim();

  return result;
}
