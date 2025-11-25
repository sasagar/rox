/**
 * API Endpoints Integration Tests
 *
 * Tests core API functionality including:
 * - Authentication
 * - Notes CRUD
 * - Reactions
 * - Following
 * - Timelines
 */

import { describe, test, expect, beforeAll } from 'bun:test';

const BASE_URL = process.env.TEST_URL || 'http://localhost:3000';

describe('API Endpoints Integration', () => {
  let user1: { user: any; token: string };
  let user2: { user: any; token: string };

  beforeAll(async () => {
    // Create two test users
    const user1Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `user1_${Date.now()}`,
        password: 'password123',
        email: `user1_${Date.now()}@test.com`,
      }),
    });
    user1 = (await user1Res.json()) as { user: any; token: string };

    const user2Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: `user2_${Date.now()}`,
        password: 'password123',
        email: `user2_${Date.now()}@test.com`,
      }),
    });
    user2 = (await user2Res.json()) as { user: any; token: string };
  });

  describe('Authentication', () => {
    test('should validate session', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/session`, {
        headers: {
          Authorization: `Bearer ${user1.token}`,
        },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.user.id).toBe(user1.user.id);
    });

    test('should reject invalid token', async () => {
      const res = await fetch(`${BASE_URL}/api/auth/session`, {
        headers: {
          Authorization: 'Bearer invalid-token',
        },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('Notes', () => {
    let testNoteId: string;

    test('should create a note', async () => {
      const res = await fetch(`${BASE_URL}/api/notes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user1.token}`,
        },
        body: JSON.stringify({
          text: 'Test note content',
          visibility: 'public',
        }),
      });

      expect(res.status).toBe(201);
      const note = (await res.json()) as any;
      expect(note.id).toBeDefined();
      expect(note.text).toBe('Test note content');
      expect(note.userId).toBe(user1.user.id);

      testNoteId = note.id;
    });

    test('should get note by ID', async () => {
      const res = await fetch(`${BASE_URL}/api/notes/show?noteId=${testNoteId}`);

      expect(res.status).toBe(200);
      const note = (await res.json()) as any;
      expect(note.id).toBe(testNoteId);
      expect(note.text).toBe('Test note content');
    });

    test('should delete own note', async () => {
      // Create a note to delete
      const createRes = await fetch(`${BASE_URL}/api/notes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user1.token}`,
        },
        body: JSON.stringify({
          text: 'Note to be deleted',
          visibility: 'public',
        }),
      });
      const note = (await createRes.json()) as any;

      // Delete the note
      const deleteRes = await fetch(`${BASE_URL}/api/notes/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user1.token}`,
        },
        body: JSON.stringify({
          noteId: note.id,
        }),
      });

      expect(deleteRes.status).toBe(200);

      // Verify deleted
      const getRes = await fetch(`${BASE_URL}/api/notes/show?noteId=${note.id}`);
      expect(getRes.status).toBe(404);
    });

    test('should get local timeline', async () => {
      const res = await fetch(`${BASE_URL}/api/notes/local-timeline?limit=10`);

      expect(res.status).toBe(200);
      const notes = (await res.json()) as any;
      expect(notes).toBeArray();
      expect(notes.length).toBeGreaterThan(0);
    });
  });

  describe('Reactions', () => {
    let testNoteId: string;

    beforeAll(async () => {
      // Create a note to react to
      const noteRes = await fetch(`${BASE_URL}/api/notes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user1.token}`,
        },
        body: JSON.stringify({
          text: 'Note to react to',
          visibility: 'public',
        }),
      });
      const note = (await noteRes.json()) as any;
      testNoteId = note.id;
    });

    test('should create a reaction', async () => {
      const res = await fetch(`${BASE_URL}/api/notes/reactions/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user2.token}`,
        },
        body: JSON.stringify({
          noteId: testNoteId,
          reaction: '👍',
        }),
      });

      expect(res.status).toBe(201);
      const reaction = (await res.json()) as any;
      expect(reaction.noteId).toBe(testNoteId);
      expect(reaction.userId).toBe(user2.user.id);
      expect(reaction.reaction).toBe('👍');
    });

    test('should get reaction counts', async () => {
      const res = await fetch(
        `${BASE_URL}/api/notes/reactions/counts?noteId=${testNoteId}`
      );

      expect(res.status).toBe(200);
      const counts = (await res.json()) as any;
      expect(counts['👍']).toBe(1);
    });

    test('should get user reactions', async () => {
      const res = await fetch(
        `${BASE_URL}/api/notes/reactions/my-reactions?noteId=${testNoteId}`,
        {
          headers: {
            Authorization: `Bearer ${user2.token}`,
          },
        }
      );

      expect(res.status).toBe(200);
      const reactions = (await res.json()) as any;
      expect(reactions).toBeArray();
      expect(reactions.length).toBe(1);
      expect(reactions[0].reaction).toBe('👍');
    });

    test('should delete reaction', async () => {
      const deleteRes = await fetch(`${BASE_URL}/api/notes/reactions/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user2.token}`,
        },
        body: JSON.stringify({
          noteId: testNoteId,
          reaction: '👍',
        }),
      });

      expect(deleteRes.status).toBe(200);

      // Verify deleted
      const countsRes = await fetch(
        `${BASE_URL}/api/notes/reactions/counts?noteId=${testNoteId}`
      );
      const counts = (await countsRes.json()) as any;
      expect(counts['👍']).toBeUndefined();
    });
  });

  describe('Following', () => {
    test('should create follow relationship', async () => {
      const res = await fetch(`${BASE_URL}/api/following/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user1.token}`,
        },
        body: JSON.stringify({
          userId: user2.user.id,
        }),
      });

      expect(res.status).toBe(201);
      const follow = (await res.json()) as any;
      expect(follow.followerId).toBe(user1.user.id);
      expect(follow.followeeId).toBe(user2.user.id);
    });

    test('should check if following', async () => {
      const res = await fetch(
        `${BASE_URL}/api/following/exists?userId=${user2.user.id}`,
        {
          headers: {
            Authorization: `Bearer ${user1.token}`,
          },
        }
      );

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.exists).toBe(true);
    });

    test('should delete follow relationship', async () => {
      const res = await fetch(`${BASE_URL}/api/following/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user1.token}`,
        },
        body: JSON.stringify({
          userId: user2.user.id,
        }),
      });

      expect(res.status).toBe(200);

      // Verify deleted
      const existsRes = await fetch(
        `${BASE_URL}/api/following/exists?userId=${user2.user.id}`,
        {
          headers: {
            Authorization: `Bearer ${user1.token}`,
          },
        }
      );
      const data = (await existsRes.json()) as any;
      expect(data.exists).toBe(false);
    });
  });

  describe('Timelines', () => {
    beforeAll(async () => {
      // Create follow relationship
      await fetch(`${BASE_URL}/api/following/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user1.token}`,
        },
        body: JSON.stringify({
          userId: user2.user.id,
        }),
      });

      // User2 creates a note
      await fetch(`${BASE_URL}/api/notes/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${user2.token}`,
        },
        body: JSON.stringify({
          text: 'Note for timeline test',
          visibility: 'public',
        }),
      });
    });

    test('should get home timeline with followed users notes', async () => {
      const res = await fetch(`${BASE_URL}/api/notes/timeline?limit=20`, {
        headers: {
          Authorization: `Bearer ${user1.token}`,
        },
      });

      expect(res.status).toBe(200);
      const notes = (await res.json()) as any;
      expect(notes).toBeArray();

      // Should include notes from user2 (followed user)
      const hasFollowedNote = notes.some(
        (n: any) => n.userId === user2.user.id && n.text === 'Note for timeline test'
      );
      expect(hasFollowedNote).toBe(true);
    });

    test('should get social timeline', async () => {
      const res = await fetch(`${BASE_URL}/api/notes/social-timeline?limit=20`, {
        headers: {
          Authorization: `Bearer ${user1.token}`,
        },
      });

      expect(res.status).toBe(200);
      const notes = (await res.json()) as any;
      expect(notes).toBeArray();
      expect(notes.length).toBeGreaterThan(0);
    });
  });
});
