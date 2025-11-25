/**
 * ActivityPub Outbox Collection
 *
 * Provides read access to a user's outgoing activities.
 * Implements OrderedCollection with pagination support.
 *
 * @module routes/ap/outbox
 */

import { Hono } from 'hono';
import type { Context } from 'hono';

const outbox = new Hono();

/**
 * GET /users/:username/outbox
 *
 * Returns an OrderedCollection of the user's outgoing activities.
 * Supports pagination via ?page=N query parameter.
 *
 * @example
 * GET /users/alice/outbox
 * GET /users/alice/outbox?page=1
 */
outbox.get('/:username/outbox', async (c: Context) => {
  const { username } = c.req.param();
  const page = c.req.query('page');

  // Get user
  const userRepository = c.get('userRepository');
  const user = await userRepository.findByUsername(username as string);

  if (!user || user.host !== null) {
    return c.notFound();
  }

  const baseUrl = process.env.URL || 'http://localhost:3000';
  const outboxUrl = `${baseUrl}/users/${username}/outbox`;

  // If no page parameter, return collection metadata
  if (!page) {
    const noteRepository = c.get('noteRepository');

    // Count total items (notes created by this user)
    const notes = await noteRepository.findByUserId(user.id, {});
    const totalItems = notes.length;

    const collection = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      id: outboxUrl,
      type: 'OrderedCollection',
      totalItems,
      first: `${outboxUrl}?page=1`,
    };

    return c.json(collection, 200, {
      'Content-Type': 'application/activity+json; charset=utf-8',
    });
  }

  // Return paginated collection
  const pageNum = parseInt(page, 10);
  if (isNaN(pageNum) || pageNum < 1) {
    return c.json({ error: 'Invalid page number' }, 400);
  }

  const noteRepository = c.get('noteRepository');
  const limit = 20;

  // Get user's notes with pagination
  const notes = await noteRepository.findByUserId(user.id, { limit });

  // Convert notes to Create activities
  const orderedItems = notes.map((note) => ({
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${baseUrl}/activities/${note.id}`,
    type: 'Create',
    actor: `${baseUrl}/users/${username}`,
    published: note.createdAt.toISOString(),
    to: ['https://www.w3.org/ns/activitystreams#Public'],
    cc: [`${baseUrl}/users/${username}/followers`],
    object: {
      id: `${baseUrl}/notes/${note.id}`,
      type: 'Note',
      attributedTo: `${baseUrl}/users/${username}`,
      content: note.text,
      published: note.createdAt.toISOString(),
      to: ['https://www.w3.org/ns/activitystreams#Public'],
      cc: [`${baseUrl}/users/${username}/followers`],
    },
  }));

  const collectionPage = {
    '@context': 'https://www.w3.org/ns/activitystreams',
    id: `${outboxUrl}?page=${pageNum}`,
    type: 'OrderedCollectionPage',
    partOf: outboxUrl,
    orderedItems,
  };

  // Add next/prev links if applicable
  if (notes.length === limit) {
    (collectionPage as any).next = `${outboxUrl}?page=${pageNum + 1}`;
  }
  if (pageNum > 1) {
    (collectionPage as any).prev = `${outboxUrl}?page=${pageNum - 1}`;
  }

  return c.json(collectionPage, 200, {
    'Content-Type': 'application/activity+json; charset=utf-8',
  });
});

export default outbox;
