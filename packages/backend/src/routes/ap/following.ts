/**
 * ActivityPub Following Collection
 *
 * Provides read access to users that this user is following.
 * Implements OrderedCollection with pagination support.
 *
 * @module routes/ap/following
 */

import { Hono } from "hono";
import type { Context } from "hono";

const following = new Hono();

/**
 * GET /users/:username/following
 *
 * Returns an OrderedCollection of users this user is following.
 * Supports pagination via ?page=N query parameter.
 *
 * @example
 * GET /users/alice/following
 * GET /users/alice/following?page=1
 */
following.get("/:username/following", async (c: Context) => {
  const { username } = c.req.param();
  const page = c.req.query("page");

  // Get user
  const userRepository = c.get("userRepository");
  const user = await userRepository.findByUsername(username as string);

  if (!user || user.host !== null) {
    return c.notFound();
  }

  const baseUrl = process.env.URL || "http://localhost:3000";
  const followingUrl = `${baseUrl}/users/${username}/following`;

  // If no page parameter, return collection metadata
  if (!page) {
    const followRepository = c.get("followRepository");

    // Get all following (users this user follows)
    const followingRelations = await followRepository.findByFollowerId(user.id);
    const totalItems = followingRelations.length;

    const collection = {
      "@context": "https://www.w3.org/ns/activitystreams",
      id: followingUrl,
      type: "OrderedCollection",
      totalItems,
      first: `${followingUrl}?page=1`,
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

  // Get following with pagination
  const followingRelations = await followRepository.findByFollowerId(user.id);
  const sortedRelations = followingRelations.sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  const paginatedRelations = sortedRelations.slice(offset, offset + limit);

  // Get following user objects
  const followingUsers = await Promise.all(
    paginatedRelations.map(async (rel) => {
      const followingUser = await userRepository.findById(rel.followeeId);
      return followingUser;
    }),
  );

  // Convert to actor URIs
  const orderedItems = followingUsers
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
    id: `${followingUrl}?page=${pageNum}`,
    type: "OrderedCollectionPage",
    partOf: followingUrl,
    orderedItems,
  };

  // Add next/prev links if applicable
  if (offset + limit < sortedRelations.length) {
    (collectionPage as any).next = `${followingUrl}?page=${pageNum + 1}`;
  }
  if (pageNum > 1) {
    (collectionPage as any).prev = `${followingUrl}?page=${pageNum - 1}`;
  }

  return c.json(collectionPage, 200, {
    "Content-Type": "application/activity+json; charset=utf-8",
  });
});

export default following;
