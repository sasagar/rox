/**
 * ActivityPub Federation E2E Tests
 *
 * Tests end-to-end ActivityPub federation scenarios including:
 * - WebFinger discovery
 * - Actor retrieval
 * - Follow/Accept flow
 * - Note creation and delivery
 * - Reaction (Like) delivery
 */

import { describe, test, expect, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

describe('ActivityPub Federation E2E', () => {
  let testUser: any;
  let testSession: string;

  beforeAll(async () => {
    // Create test user with short timestamp to stay under 20 char limit
    const timestamp = Date.now().toString().slice(-6); // Last 6 digits
    const registerRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `test${timestamp}`,
        password: 'test-password-123',
        email: `test${timestamp}@example.com`,
      }),
    });

    if (!registerRes.ok) {
      throw new Error(`Failed to register test user: ${await registerRes.text()}`);
    }

    const registerData = (await registerRes.json()) as { user: any; token: string };
    testUser = registerData.user;
    testSession = registerData.token;
  });

  describe('WebFinger', () => {
    test('should respond to WebFinger query for local user', async () => {
      const domain = new URL(BASE_URL).hostname;
      const resource = `acct:${testUser.username}@${domain}`;

      const res = await fetch(
        `${BASE_URL}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`
      );

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/jrd+json');

      const jrd = (await res.json()) as any;
      expect(jrd.subject).toBe(resource);
      expect(jrd.links).toBeArray();
      expect(jrd.links.length).toBeGreaterThan(0);

      const selfLink = jrd.links.find((l: any) => l.rel === 'self');
      expect(selfLink).toBeDefined();
      expect(selfLink.type).toBe('application/activity+json');
      expect(selfLink.href).toBe(`${BASE_URL}/users/${testUser.username}`);
    });

    test('should return 404 for non-existent user', async () => {
      const domain = new URL(BASE_URL).hostname;
      const resource = `acct:nonexistent@${domain}`;

      const res = await fetch(
        `${BASE_URL}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`
      );

      expect(res.status).toBe(404);
    });

    test('should return 404 for remote domain', async () => {
      const resource = `acct:${testUser.username}@remote.example.com`;

      const res = await fetch(
        `${BASE_URL}/.well-known/webfinger?resource=${encodeURIComponent(resource)}`
      );

      expect(res.status).toBe(404);
    });
  });

  describe('Actor', () => {
    test('should return Actor document with ActivityPub Accept header', async () => {
      const res = await fetch(`${BASE_URL}/users/${testUser.username}`, {
        headers: {
          Accept: 'application/activity+json',
        },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/activity+json');

      const actor = (await res.json()) as any;
      expect(actor.type).toBe('Person');
      expect(actor.preferredUsername).toBe(testUser.username);
      expect(actor.inbox).toBe(`${BASE_URL}/users/${testUser.username}/inbox`);
      expect(actor.outbox).toBe(`${BASE_URL}/users/${testUser.username}/outbox`);
      expect(actor.followers).toBe(`${BASE_URL}/users/${testUser.username}/followers`);
      expect(actor.following).toBe(`${BASE_URL}/users/${testUser.username}/following`);
      expect(actor.publicKey).toBeDefined();
      expect(actor.publicKey.id).toBe(`${BASE_URL}/users/${testUser.username}#main-key`);
      expect(actor.publicKey.publicKeyPem).toBeDefined();
    });

    test('should redirect to frontend without ActivityPub Accept header', async () => {
      const res = await fetch(`${BASE_URL}/users/${testUser.username}`, {
        redirect: 'manual',
      });

      expect(res.status).toBe(302);
      expect(res.headers.get('location')).toBe(`/@${testUser.username}`);
    });

    test('should return 404 for non-existent actor', async () => {
      const res = await fetch(`${BASE_URL}/users/nonexistent`, {
        headers: {
          Accept: 'application/activity+json',
        },
      });

      expect(res.status).toBe(404);
    });
  });

  describe('Outbox', () => {
    beforeAll(async () => {
      // Create a test note
      const noteRes = await fetch(`${BASE_URL}/api/notes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testSession}`,
        },
        body: JSON.stringify({
          text: 'Test note for outbox',
          visibility: 'public',
        }),
      });

      await noteRes.json();
    });

    test('should return OrderedCollection metadata', async () => {
      const res = await fetch(`${BASE_URL}/users/${testUser.username}/outbox`, {
        headers: {
          Accept: 'application/activity+json',
        },
      });

      expect(res.status).toBe(200);
      const collection = (await res.json()) as any;

      expect(collection.type).toBe('OrderedCollection');
      expect(collection.totalItems).toBeGreaterThanOrEqual(1);
      expect(collection.first).toBe(`${BASE_URL}/users/${testUser.username}/outbox?page=1`);
    });

    test('should return paginated activities', async () => {
      const res = await fetch(`${BASE_URL}/users/${testUser.username}/outbox?page=1`, {
        headers: {
          Accept: 'application/activity+json',
        },
      });

      expect(res.status).toBe(200);
      const page = (await res.json()) as any;

      expect(page.type).toBe('OrderedCollectionPage');
      expect(page.orderedItems).toBeArray();
      expect(page.orderedItems.length).toBeGreaterThanOrEqual(1);

      const createActivity = page.orderedItems.find((item: any) => item.type === 'Create');
      expect(createActivity).toBeDefined();
      expect(createActivity.object.type).toBe('Note');
    });
  });

  describe('Followers/Following Collections', () => {
    test('should return empty followers collection', async () => {
      const res = await fetch(`${BASE_URL}/users/${testUser.username}/followers`, {
        headers: {
          Accept: 'application/activity+json',
        },
      });

      expect(res.status).toBe(200);
      const collection = (await res.json()) as any;

      expect(collection.type).toBe('OrderedCollection');
      expect(collection.totalItems).toBe(0);
    });

    test('should return empty following collection', async () => {
      const res = await fetch(`${BASE_URL}/users/${testUser.username}/following`, {
        headers: {
          Accept: 'application/activity+json',
        },
      });

      expect(res.status).toBe(200);
      const collection = (await res.json()) as any;

      expect(collection.type).toBe('OrderedCollection');
      expect(collection.totalItems).toBe(0);
    });
  });

  describe('Note Object', () => {
    let testNoteId: string;

    beforeAll(async () => {
      // Create a test note
      const noteRes = await fetch(`${BASE_URL}/api/notes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${testSession}`,
        },
        body: JSON.stringify({
          text: 'Test note for ActivityPub object retrieval',
          visibility: 'public',
        }),
      });

      const note = (await noteRes.json()) as any;
      testNoteId = note.id;
    });

    test('should return Note object as ActivityPub', async () => {
      const res = await fetch(`${BASE_URL}/notes/${testNoteId}`, {
        headers: {
          Accept: 'application/activity+json',
        },
      });

      expect(res.status).toBe(200);
      const note = (await res.json()) as any;

      expect(note.type).toBe('Note');
      expect(note.id).toBeDefined();
      expect(note.attributedTo).toBe(`${BASE_URL}/users/${testUser.username}`);
      expect(note.content).toContain('Test note for ActivityPub object retrieval');
      expect(note.published).toBeDefined();
    });

    test('should return 404 for non-existent note', async () => {
      const res = await fetch(`${BASE_URL}/notes/nonexistent`, {
        headers: {
          Accept: 'application/activity+json',
        },
      });

      expect(res.status).toBe(404);
    });
  });
});
