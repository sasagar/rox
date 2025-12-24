import type { PageProps } from "waku/router";
import { UserProfile } from "../../components/user/UserProfile";

/**
 * Parse username parameter to extract username and host
 * Supports formats:
 * - "alice" -> { username: "alice", host: null }
 * - "@alice" -> { username: "alice", host: null }
 * - "@alice@mastodon.social" -> { username: "alice", host: "mastodon.social" }
 */
function parseUserParam(param: string): { username: string; host: string | null } {
  // Remove leading @ if present
  const cleaned = param.startsWith("@") ? param.slice(1) : param;

  // Check for remote user format (username@host)
  const atIndex = cleaned.indexOf("@");
  if (atIndex > 0) {
    return {
      username: cleaned.slice(0, atIndex),
      host: cleaned.slice(atIndex + 1),
    };
  }

  return { username: cleaned, host: null };
}

/**
 * User profile page
 * Dynamic route for displaying user profiles with OGP meta tags
 *
 * @example
 * /alice - Shows alice's profile (local)
 * /@alice - Shows alice's profile (local)
 * /@alice@mastodon.social - Shows alice's profile from mastodon.social (remote)
 */
export default async function UserPage({ username: usernameParam }: PageProps<"/[username]">) {
  if (!usernameParam) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User not found</h1>
        </div>
      </div>
    );
  }

  const { username, host } = parseUserParam(usernameParam);

  // Fetch user data for OGP meta tags (Server Component can fetch directly)
  let user: Awaited<ReturnType<typeof import("../../lib/api/users").usersApi.getByUsername>> | null = null;
  try {
    // Fetch user by username and host
    user = await import("../../lib/api/users").then(m => m.usersApi.getByUsername(username, host));
  } catch (error) {
    console.error("Failed to fetch user for OGP:", error);
  }

  // Generate OGP meta tags if user data is available
  // Use public URL for OGP meta tags (not internal Docker URL)
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "https://rox.love-rox.cc";
  const instanceName = "Rox Origin"; // TODO: Fetch from instance settings
  const themeColor = "#f97316"; // TODO: Fetch from instance settings

  const title = user
    ? `${user.displayName || user.username} (@${username}${host ? `@${host}` : ""})`
    : `@${username}${host ? `@${host}` : ""}`;
  const description = user?.bio || `View ${username}'s profile on Rox`;
  const profileUrl = `${baseUrl}/@${username}${host ? `@${host}` : ""}`;
  const avatarUrl = user?.avatarUrl || null;

  // Generate oEmbed discovery URL
  const oembedUrl = `${baseUrl}/oembed?url=${encodeURIComponent(profileUrl)}`;

  return (
    <>
      {/* OGP Meta Tags - matching Misskey's exact structure */}
      <meta name="application-name" content="Rox" />
      <meta name="referrer" content="origin" />
      <meta name="theme-color" content={themeColor} />
      <meta name="theme-color-orig" content={themeColor} />
      <meta property="og:site_name" content={instanceName} />
      <meta property="instance_url" content={baseUrl} />
      <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no" />
      <link rel="icon" href={`${baseUrl}/favicon.png`} type="image/png" />
      {/* oEmbed discovery link for Discord/Slack rich embeds */}
      <link rel="alternate" type="application/json+oembed" href={oembedUrl} title="oEmbed" />
      <title>{title} | {instanceName}</title>
      <meta name="description" content={description} />
      <meta property="og:type" content="article" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={profileUrl} />
      {avatarUrl && <meta property="og:image" content={avatarUrl} />}
      {/* User profiles always use summary card */}
      <meta property="twitter:card" content="summary" />

      <UserProfile username={username} host={host} />
    </>
  );
}

/**
 * Waku configuration for user profile page
 * Marks this page as dynamically rendered at request time
 *
 * @returns Configuration object with render mode
 */
export const getConfig = async () => {
  return {
    render: "dynamic",
  } as const;
};
