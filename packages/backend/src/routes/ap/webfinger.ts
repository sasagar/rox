/**
 * WebFinger Routes
 *
 * Implements WebFinger protocol (RFC 7033) for ActivityPub actor discovery.
 * Maps acct: URIs to ActivityPub Actor URLs.
 *
 * @module routes/ap/webfinger
 */

import { Hono } from 'hono';
import type { Context } from 'hono';

const webfinger = new Hono();

/**
 * GET /.well-known/webfinger
 *
 * WebFinger endpoint for discovering ActivityPub actors.
 *
 * @query resource - Resource identifier (acct:username@domain)
 * @returns WebFinger JRD (JSON Resource Descriptor)
 *
 * @example
 * ```bash
 * curl "https://example.com/.well-known/webfinger?resource=acct:alice@example.com"
 * ```
 */
webfinger.get('/.well-known/webfinger', async (c: Context) => {
  const resource = c.req.query('resource');

  if (!resource) {
    return c.json({ error: 'Missing resource parameter' }, 400);
  }

  // Validate acct: URI format
  if (!resource.startsWith('acct:')) {
    return c.json({ error: 'Invalid resource format (must start with acct:)' }, 400);
  }

  // Parse acct:username@domain
  const match = resource.match(/^acct:([^@]+)@(.+)$/);
  if (!match) {
    return c.json({ error: 'Invalid acct: URI format' }, 400);
  }

  const [, username, domain] = match;

  // Validate domain matches our server
  const baseUrl = process.env.URL || 'http://localhost:3000';
  const ourDomain = new URL(baseUrl).hostname;

  if (domain !== ourDomain) {
    return c.json({ error: 'Domain mismatch' }, 404);
  }

  // Look up user
  const userRepository = c.get('userRepository');
  const user = await userRepository.findByUsername(username as string);

  // 404 if user not found or is a remote user
  if (!user || user.host !== null) {
    return c.notFound();
  }

  // Build WebFinger response (JRD)
  const jrd = {
    subject: resource,
    links: [
      {
        rel: 'self',
        type: 'application/activity+json',
        href: `${baseUrl}/users/${username}`,
      },
    ],
  };

  return c.json(jrd, 200, {
    'Content-Type': 'application/jrd+json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
  });
});

export default webfinger;
