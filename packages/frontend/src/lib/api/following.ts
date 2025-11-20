/**
 * Following API client
 * Provides functions for interacting with the following API endpoints
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

/**
 * Follow relationship data structure
 */
export interface Follow {
  id: string;
  followerId: string;
  followeeId: string;
  createdAt: string;
}

/**
 * Follow a user
 *
 * @param userId - User ID to follow
 * @param token - Authentication token
 * @returns Created follow relationship
 */
export async function followUser(
  userId: string,
  token: string,
): Promise<Follow> {
  const response = await fetch(`${API_BASE}/api/following/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to follow user');
  }

  return response.json();
}

/**
 * Unfollow a user
 *
 * @param userId - User ID to unfollow
 * @param token - Authentication token
 */
export async function unfollowUser(
  userId: string,
  token: string,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/following/delete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to unfollow user');
  }
}

/**
 * Get followers list for a user
 *
 * @param userId - User ID
 * @param limit - Maximum number of followers to retrieve
 * @returns List of followers
 */
export async function getFollowers(
  userId: string,
  limit?: number,
): Promise<Follow[]> {
  const params = new URLSearchParams({ userId });
  if (limit) {
    params.append('limit', limit.toString());
  }

  const response = await fetch(`${API_BASE}/api/users/followers?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get followers');
  }

  return response.json();
}

/**
 * Get following list for a user
 *
 * @param userId - User ID
 * @param limit - Maximum number of following to retrieve
 * @returns List of following
 */
export async function getFollowing(
  userId: string,
  limit?: number,
): Promise<Follow[]> {
  const params = new URLSearchParams({ userId });
  if (limit) {
    params.append('limit', limit.toString());
  }

  const response = await fetch(`${API_BASE}/api/users/following?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get following');
  }

  return response.json();
}

/**
 * Check if current user is following a specific user
 *
 * @param userId - User ID to check
 * @param token - Authentication token
 * @returns True if following, false otherwise
 */
export async function isFollowing(
  userId: string,
  token: string,
): Promise<boolean> {
  try {
    const following = await getFollowing(userId);
    return following.length > 0;
  } catch (error) {
    console.error('Failed to check follow status:', error);
    return false;
  }
}
