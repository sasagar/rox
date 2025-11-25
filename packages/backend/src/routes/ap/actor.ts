/**
 * ActivityPub Actor Routes
 *
 * Provides Actor document endpoints for ActivityPub federation.
 * Returns JSON-LD Person objects representing users.
 *
 * @module routes/ap/actor
 */

import { Hono } from 'hono';
import type { Context } from 'hono';

const actor = new Hono();

/**
 * GET /:username
 *
 * Returns ActivityPub Actor document for a local user.
 * Content negotiation is performed based on the Accept header.
 *
 * @param username - Username of the actor
 * @returns Actor document (JSON-LD) or redirect to frontend
 *
 * @example
 * ```bash
 * curl -H "Accept: application/activity+json" https://example.com/alice
 * ```
 */
actor.get('/:username', async (c: Context) => {
  const { username } = c.req.param();
  const accept = c.req.header('Accept') || '';

  // ActivityPub content negotiation
  const isActivityPubRequest =
    accept.includes('application/activity+json') || accept.includes('application/ld+json');

  // If not an ActivityPub request, redirect to frontend
  if (!isActivityPubRequest) {
    return c.redirect(`/@${username}`);
  }

  const userRepository = c.get('userRepository');
  const user = await userRepository.findByUsername(username as string);

  // 404 if user not found or is a remote user
  if (!user || user.host !== null) {
    return c.notFound();
  }

  const baseUrl = process.env.URL || 'http://localhost:3000';

  // Build ActivityPub Actor document
  const actorDocument = {
    '@context': [
      'https://www.w3.org/ns/activitystreams',
      'https://w3id.org/security/v1',
    ],
    id: `${baseUrl}/users/${user.username}`,
    type: 'Person',
    preferredUsername: user.username,
    name: user.displayName || user.username,
    summary: user.bio || '',
    inbox: `${baseUrl}/users/${user.username}/inbox`,
    outbox: `${baseUrl}/users/${user.username}/outbox`,
    followers: `${baseUrl}/users/${user.username}/followers`,
    following: `${baseUrl}/users/${user.username}/following`,
    icon: user.avatarUrl
      ? {
          type: 'Image',
          mediaType: 'image/jpeg',
          url: user.avatarUrl,
        }
      : undefined,
    image: user.bannerUrl
      ? {
          type: 'Image',
          mediaType: 'image/jpeg',
          url: user.bannerUrl,
        }
      : undefined,
    publicKey: {
      id: `${baseUrl}/users/${user.username}#main-key`,
      owner: `${baseUrl}/users/${user.username}`,
      publicKeyPem: user.publicKey,
    },
  };

  return c.json(actorDocument, 200, {
    'Content-Type': 'application/activity+json; charset=utf-8',
  });
});

export default actor;
