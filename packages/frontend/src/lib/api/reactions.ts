/**
 * Reaction API client
 * Provides functions for interacting with the reaction API endpoints
 */

/**
 * Get the API base URL
 * In browser, uses same origin (proxy handles routing in dev)
 * In SSR, uses localhost
 */
function getApiBase(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3000";
}

/**
 * Reaction data structure
 */
export interface Reaction {
  id: string;
  userId: string;
  noteId: string;
  reaction: string;
  customEmojiUrl?: string;
  createdAt: string;
}

/**
 * Create or update a reaction to a note
 *
 * @param noteId - Note ID to react to
 * @param reaction - Reaction emoji (Unicode or custom emoji name)
 * @param token - Authentication token
 * @returns Created reaction
 */
export async function createReaction(
  noteId: string,
  reaction: string,
  token: string,
): Promise<Reaction> {
  const response = await fetch(`${getApiBase()}/api/notes/reactions/create`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ noteId, reaction }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to create reaction");
  }

  return response.json();
}

/**
 * Delete a specific reaction from a note
 *
 * @param noteId - Note ID to remove reaction from
 * @param reaction - Reaction emoji to remove
 * @param token - Authentication token
 */
export async function deleteReaction(
  noteId: string,
  reaction: string,
  token: string,
): Promise<void> {
  const response = await fetch(`${getApiBase()}/api/notes/reactions/delete`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ noteId, reaction }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to delete reaction");
  }
}

/**
 * Get all reactions for a note
 *
 * @param noteId - Note ID
 * @param limit - Maximum number of reactions to retrieve
 * @returns List of reactions
 */
export async function getReactions(noteId: string, limit?: number): Promise<Reaction[]> {
  const params = new URLSearchParams({ noteId });
  if (limit) {
    params.append("limit", limit.toString());
  }

  const response = await fetch(`${getApiBase()}/api/notes/reactions?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get reactions");
  }

  return response.json();
}

/**
 * Get reaction counts for a note
 *
 * @param noteId - Note ID
 * @returns Reaction counts by emoji
 */
export async function getReactionCounts(noteId: string): Promise<Record<string, number>> {
  const params = new URLSearchParams({ noteId });
  const response = await fetch(`${getApiBase()}/api/notes/reactions/counts?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get reaction counts");
  }

  return response.json();
}

/**
 * Reaction counts with custom emoji URLs
 */
export interface ReactionCountsWithEmojis {
  counts: Record<string, number>;
  emojis: Record<string, string>;
}

/**
 * Get reaction counts with custom emoji URLs for a note
 *
 * @param noteId - Note ID
 * @returns Reaction counts and custom emoji URLs
 */
export async function getReactionCountsWithEmojis(
  noteId: string,
): Promise<ReactionCountsWithEmojis> {
  const params = new URLSearchParams({ noteId });
  const response = await fetch(`${getApiBase()}/api/notes/reactions/counts-with-emojis?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get reaction counts");
  }

  return response.json();
}

/**
 * Get current user's reactions to a note
 *
 * @param noteId - Note ID
 * @param token - Authentication token
 * @returns User's reactions
 */
export async function getMyReactions(noteId: string, token: string): Promise<Reaction[]> {
  const params = new URLSearchParams({ noteId });
  const response = await fetch(`${getApiBase()}/api/notes/reactions/my-reactions?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || "Failed to get user reactions");
  }

  return response.json();
}
