/**
 * Admin Middleware Unit Tests
 *
 * Tests admin authentication middleware including:
 * - requireAdmin middleware
 * - Suspended user blocking in requireAuth
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import type { User } from '../../db/schema/pg.js';
import type { Session } from 'shared';

describe('Admin Middleware', () => {
  // Mock data
  const createMockUser = (overrides: Partial<User> = {}): User => ({
    id: 'user1',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$mock',
    displayName: 'Test User',
    host: null,
    avatarUrl: null,
    bannerUrl: null,
    bio: null,
    isAdmin: false,
    isSuspended: false,
    publicKey: 'mock-public-key',
    privateKey: 'mock-private-key',
    inbox: 'http://localhost:3000/users/testuser/inbox',
    outbox: 'http://localhost:3000/users/testuser/outbox',
    followersUrl: 'http://localhost:3000/users/testuser/followers',
    followingUrl: 'http://localhost:3000/users/testuser/following',
    uri: 'http://localhost:3000/users/testuser',
    sharedInbox: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const mockSession: Session = {
    id: 'session1',
    userId: 'user1',
    token: 'valid-token',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    userAgent: null,
    ipAddress: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  let mockUserRepo: any;
  let mockSessionRepo: any;

  beforeEach(() => {
    mockUserRepo = {
      findById: mock(() => Promise.resolve(createMockUser())),
    };
    mockSessionRepo = {
      findByToken: mock(() => Promise.resolve(mockSession)),
      delete: mock(() => Promise.resolve()),
      deleteByToken: mock(() => Promise.resolve()),
    };
  });

  describe('requireAuth with suspension check', () => {
    test('should allow non-suspended users', async () => {
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userRepository', mockUserRepo);
        c.set('sessionRepository', mockSessionRepo);
        await next();
      });
      app.get('/test', requireAuth(), (c) => c.json({ success: true }));

      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.status).toBe(200);
    });

    test('should block suspended users with 401 (session invalidated)', async () => {
      // When a user is suspended, AuthService.validateSession() returns null
      // (after deleting their session), so they get 401 instead of 403
      mockUserRepo.findById = mock(() =>
        Promise.resolve(createMockUser({ isSuspended: true }))
      );

      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userRepository', mockUserRepo);
        c.set('sessionRepository', mockSessionRepo);
        await next();
      });
      app.get('/test', requireAuth(), (c) => c.json({ success: true }));

      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      // Suspended users have their session deleted, resulting in 401
      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('Invalid or expired token');
    });

    test('should return 401 for missing token', async () => {
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userRepository', mockUserRepo);
        c.set('sessionRepository', mockSessionRepo);
        await next();
      });
      app.get('/test', requireAuth(), (c) => c.json({ success: true }));

      const res = await app.request('/test');

      expect(res.status).toBe(401);
    });

    test('should return 401 for invalid token', async () => {
      mockSessionRepo.findByToken = mock(() => Promise.resolve(null));

      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userRepository', mockUserRepo);
        c.set('sessionRepository', mockSessionRepo);
        await next();
      });
      app.get('/test', requireAuth(), (c) => c.json({ success: true }));

      const res = await app.request('/test', {
        headers: { Authorization: 'Bearer invalid-token' },
      });

      expect(res.status).toBe(401);
    });
  });

  describe('requireAdmin', () => {
    test('should allow admin users', async () => {
      mockUserRepo.findById = mock(() =>
        Promise.resolve(createMockUser({ isAdmin: true }))
      );

      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userRepository', mockUserRepo);
        c.set('sessionRepository', mockSessionRepo);
        await next();
      });
      app.get('/admin', requireAdmin(), (c) => c.json({ admin: true }));

      const res = await app.request('/admin', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.status).toBe(200);
      const data = (await res.json()) as { admin: boolean };
      expect(data.admin).toBe(true);
    });

    test('should reject non-admin users with 403', async () => {
      mockUserRepo.findById = mock(() =>
        Promise.resolve(createMockUser({ isAdmin: false }))
      );

      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userRepository', mockUserRepo);
        c.set('sessionRepository', mockSessionRepo);
        await next();
      });
      app.get('/admin', requireAdmin(), (c) => c.json({ admin: true }));

      const res = await app.request('/admin', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      expect(res.status).toBe(403);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('Admin access required');
    });

    test('should reject suspended admin with 401 (session invalidated)', async () => {
      // When a user is suspended, AuthService.validateSession() returns null
      // (after deleting their session), so they get 401 instead of 403
      mockUserRepo.findById = mock(() =>
        Promise.resolve(createMockUser({ isAdmin: true, isSuspended: true }))
      );

      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userRepository', mockUserRepo);
        c.set('sessionRepository', mockSessionRepo);
        await next();
      });
      app.get('/admin', requireAdmin(), (c) => c.json({ admin: true }));

      const res = await app.request('/admin', {
        headers: { Authorization: 'Bearer valid-token' },
      });

      // Suspended users have their session deleted, resulting in 401
      expect(res.status).toBe(401);
      const data = (await res.json()) as { error: string };
      expect(data.error).toBe('Invalid or expired token');
    });

    test('should return 401 for unauthenticated requests', async () => {
      const app = new Hono();
      app.use('*', async (c, next) => {
        c.set('userRepository', mockUserRepo);
        c.set('sessionRepository', mockSessionRepo);
        await next();
      });
      app.get('/admin', requireAdmin(), (c) => c.json({ admin: true }));

      const res = await app.request('/admin');

      expect(res.status).toBe(401);
    });
  });
});
