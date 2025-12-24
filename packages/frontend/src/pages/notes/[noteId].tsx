import type { PageProps } from "waku/router";
import { NoteDetailPageClient } from "../../components/pages/NoteDetailPageClient";
import { notesApi } from "../../lib/api/notes";
import { usersApi } from "../../lib/api/users";

/**
 * Note detail page (Server Component)
 * Renders the client component with dynamic routing configuration and OGP meta tags
 */
export default async function NoteDetailPage({ noteId }: PageProps<"/notes/[noteId]">) {
  if (!noteId) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Note not found</h1>
        </div>
      </div>
    );
  }

  // Fetch note data for OGP meta tags (Server Component can fetch directly)
  // Note: Server-side rendering needs to use internal Docker network
  // Environment variable INTERNAL_API_URL should be set to http://rox-backend:3000
  let note = null;
  let user = null;
  try {
    // In SSR context, we need to use the internal API URL
    // This is handled by the API client's default baseUrl configuration
    note = await notesApi.getNote(noteId);
    if (note?.user?.id) {
      user = await usersApi.getById(note.user.id);
    }
  } catch (error) {
    console.error("Failed to fetch note for OGP:", error);
    // Continue without OGP data - page will still render but without meta tags
  }

  // Generate OGP meta tags if note data is available
  // Use public URL for OGP meta tags (not internal Docker URL)
  const baseUrl = process.env.URL || "https://rox.love-rox.cc";
  const instanceName = "Rox Origin"; // TODO: Fetch from instance settings
  const themeColor = "#f97316"; // TODO: Fetch from instance settings

  // Build title and description from note content
  const title = note?.text || "Note";
  const description = note?.cw || note?.text?.substring(0, 200) || "View this note on Rox";
  const noteUrl = `${baseUrl}/notes/${noteId}`;

  // Get first image from attachments
  const imageUrl = note?.fileIds && note.fileIds.length > 0
    ? `${baseUrl}/api/drive/files/${note.fileIds[0]}`
    : null;

  // Get author avatar
  const authorAvatarUrl = user?.avatarUrl || null;

  // Generate oEmbed discovery URL
  const oembedUrl = note
    ? `${baseUrl}/oembed?url=${encodeURIComponent(noteUrl)}`
    : null;

  return (
    <>
      {/* OGP Meta Tags - matching Misskey's exact structure */}
      {note && (
        <>
          <meta name="application-name" content="Rox" />
          <meta name="referrer" content="origin" />
          <meta name="theme-color" content={themeColor} />
          <meta name="theme-color-orig" content={themeColor} />
          <meta property="og:site_name" content={instanceName} />
          <meta property="instance_url" content={baseUrl} />
          <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
          <link rel="icon" href={`${baseUrl}/favicon.png`} type="image/png" />
          {/* oEmbed discovery link for Discord/Slack rich embeds */}
          {oembedUrl && (
            <link rel="alternate" type="application/json+oembed" href={oembedUrl} title="oEmbed" />
          )}
          <title>{title} | {instanceName}</title>
          <meta name="description" content={description} />
          <meta property="og:type" content="article" />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={description} />
          <meta property="og:url" content={noteUrl} />
          {(imageUrl || authorAvatarUrl) && (
            <meta property="og:image" content={imageUrl || authorAvatarUrl || ""} />
          )}
          {/* Use summary_large_image for posts with images, summary for text-only */}
          <meta property="twitter:card" content={imageUrl ? "summary_large_image" : "summary"} />
        </>
      )}

      <NoteDetailPageClient noteId={noteId} />
    </>
  );
}

/**
 * Page configuration for Waku
 * Dynamic rendering for parameterized routes
 */
export const getConfig = async () => {
  return {
    render: "dynamic",
  } as const;
};
