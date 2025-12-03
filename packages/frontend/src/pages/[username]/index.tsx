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
 * Dynamic route for displaying user profiles
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

  return <UserProfile username={username} host={host} />;
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
