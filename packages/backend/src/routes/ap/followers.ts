/**
 * ActivityPub Followers Collection
 *
 * Provides read access to a user's followers.
 * Implements OrderedCollection with pagination support.
 *
 * @module routes/ap/followers
 */

import { Hono } from "hono";
import type { Context } from "hono";

const followers = new Hono();

/**
 * GET /users/:username/followers
 *
 * Returns an OrderedCollection of the user's followers.
 * Supports pagination via ?page=N query parameter.
 *
 * @example
 * GET /users/alice/followers
 * GET /users/alice/followers?page=1
 */
followers.get("/:username/followers", async (c: Context) => {
  const { username } = c.req.param();
  const page = c.req.query("page");

  // Get user
  const userRepository = c.get("userRepository");
  const user = await userRepository.findByUsername(username as string);

  if (!user || user.host !== null) {
    return c.notFound();
  }

  const baseUrl = process.env.URL || "http://localhost:3000";
  const followersUrl = `${baseUrl}/users/${username}/followers`;

  // If no page parameter, return collection metadata
  if (!page) {
    const followRepository = c.get("followRepository");

    // Get all followers (users who follow this user)
    const followerRelations = await followRepository.findByFolloweeId(user.id);
    const totalItems = followerRelations.length;

    const collection = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: followersUrl,
      type: "OrderedCollection",
      totalItems,
      first: `${followersUrl}?page=1`,
    };

    return c.json(collection, 200, {
      "Content-Type": "application/activity+json; charset=utf-8",
    });
  }

  // Return paginated collection
  const pageNum = parseInt(page, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    return c.json({ error: "Invalid page number" }, 400);
  }

  const followRepository = c.get("followRepository");
  const limit = 20;
  const offset = (pageNum - 1) * limit;

  // Get followers with pagination
  const followerRelations = await followRepository.findByFolloweeId(user.id);
  const sortedRelations = followerRelations.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const paginatedRelations = sortedRelations.slice(offset, offset + limit);

  // Get follower user objects
  const followerUsers = await Promise.all(
    paginatedRelations.map(async (rel) => {
      const followerUser = await userRepository.findById(rel.followerId);
      return followerUser;
    }),
  );

  // Convert to actor URIs
  const orderedItems = followerUsers
    .filter((u) => u !== null)
    .map((u) => {
      if (u!.host === null) {
        // Local user
        return `${baseUrl}/users/${u!.username}`;
      } else {
        // Remote user - use their stored URI
        return u!.uri || `https://${u!.host}/users/${u!.username}`;
      }
    });

  const collectionPage = {
    "@context": "https://www.w3.org/ns/activitystreams",
    id: `${followersUrl}?page=${pageNum}`,
    type: "OrderedCollectionPage",
    partOf: followersUrl,
    orderedItems,
  };

  // Add next/prev links if applicable
  if (offset + limit < sortedRelations.length) {
    (collectionPage as any).next = `${followersUrl}?page=${pageNum + 1}`;
  }
  if (pageNum > 1) {
    (collectionPage as any).prev = `${followersUrl}?page=${pageNum - 1}`;
  }

  return c.json(collectionPage, 200, {
    "Content-Type": "application/activity+json; charset=utf-8",
  });
});

export default followers;
