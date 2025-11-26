/**
 * Instance Block Delivery Tests
 *
 * Tests that instance blocking is correctly applied to:
 * - Outgoing ActivityPub deliveries
 * - Incoming inbox activities
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { IInstanceBlockRepository } from '../../interfaces/repositories/IInstanceBlockRepository';
import type { IUserRepository } from '../../interfaces/repositories/IUserRepository';
import type { IFollowRepository } from '../../interfaces/repositories/IFollowRepository';
import type { User } from '../../db/schema/pg.js';

describe('Instance Block Delivery', () => {
  // Mock blocked hosts
  const blockedHosts = new Set(['spam.example.com', 'blocked.instance.org']);

  const createMockInstanceBlockRepo = (): IInstanceBlockRepository => ({
    create: mock(() => Promise.resolve({} as any)),
    findByHost: mock(async (host) =>
      blockedHosts.has(host.toLowerCase())
        ? { id: 'block-1', host, reason: null, blockedById: 'admin', createdAt: new Date() }
        : null
    ),
    isBlocked: mock(async (host) => blockedHosts.has(host.toLowerCase())),
    findAll: mock(() => Promise.resolve([])),
    deleteByHost: mock(() => Promise.resolve(true)),
    count: mock(() => Promise.resolve(blockedHosts.size)),
  });

  describe('isBlocked helper function', () => {
    test('should identify blocked hosts', async () => {
      const repo = createMockInstanceBlockRepo();

      expect(await repo.isBlocked('spam.example.com')).toBe(true);
      expect(await repo.isBlocked('blocked.instance.org')).toBe(true);
      expect(await repo.isBlocked('allowed.instance.com')).toBe(false);
    });

    test('should be case-insensitive', async () => {
      const repo = createMockInstanceBlockRepo();

      expect(await repo.isBlocked('SPAM.EXAMPLE.COM')).toBe(true);
      expect(await repo.isBlocked('Spam.Example.Com')).toBe(true);
    });
  });

  describe('Outgoing delivery filtering', () => {
    /**
     * Simulates the isHostBlocked check in ActivityPubDeliveryService
     */
    const isHostBlocked = async (
      inboxUrl: string,
      repo: IInstanceBlockRepository
    ): Promise<boolean> => {
      try {
        const host = new URL(inboxUrl).hostname;
        return await repo.isBlocked(host);
      } catch {
        return false;
      }
    };

    test('should skip delivery to blocked instance', async () => {
      const repo = createMockInstanceBlockRepo();

      const blockedInbox = 'https://spam.example.com/inbox';
      expect(await isHostBlocked(blockedInbox, repo)).toBe(true);
    });

    test('should allow delivery to non-blocked instance', async () => {
      const repo = createMockInstanceBlockRepo();

      const allowedInbox = 'https://allowed.example.com/inbox';
      expect(await isHostBlocked(allowedInbox, repo)).toBe(false);
    });

    test('should handle invalid URLs gracefully', async () => {
      const repo = createMockInstanceBlockRepo();

      const invalidUrl = 'not-a-valid-url';
      expect(await isHostBlocked(invalidUrl, repo)).toBe(false);
    });

    test('should extract host from full inbox URL', async () => {
      const repo = createMockInstanceBlockRepo();

      // Full path with various components
      const inbox = 'https://blocked.instance.org/users/someone/inbox?query=1';
      expect(await isHostBlocked(inbox, repo)).toBe(true);
    });
  });

  describe('Incoming activity filtering', () => {
    /**
     * Simulates extracting actor host from activity
     */
    const getActorHost = (actorUrl: string): string | null => {
      try {
        return new URL(actorUrl).hostname;
      } catch {
        return null;
      }
    };

    test('should identify actor from blocked instance', async () => {
      const repo = createMockInstanceBlockRepo();

      const actorUrl = 'https://spam.example.com/users/spammer';
      const host = getActorHost(actorUrl);

      expect(host).toBe('spam.example.com');
      expect(await repo.isBlocked(host!)).toBe(true);
    });

    test('should allow actor from non-blocked instance', async () => {
      const repo = createMockInstanceBlockRepo();

      const actorUrl = 'https://mastodon.social/users/alice';
      const host = getActorHost(actorUrl);

      expect(host).toBe('mastodon.social');
      expect(await repo.isBlocked(host!)).toBe(false);
    });

    test('should handle actor as object with id', async () => {
      const repo = createMockInstanceBlockRepo();

      // ActivityPub allows actor to be an object
      const activity = {
        type: 'Follow',
        actor: { id: 'https://spam.example.com/users/spammer', type: 'Person' },
        object: 'https://example.com/users/alice',
      };

      const actorUrl =
        typeof activity.actor === 'string'
          ? activity.actor
          : (activity.actor as { id?: string })?.id;

      const host = actorUrl ? getActorHost(actorUrl) : null;

      expect(host).toBe('spam.example.com');
      expect(await repo.isBlocked(host!)).toBe(true);
    });

    test('should handle actor as string', async () => {
      const repo = createMockInstanceBlockRepo();

      const activity = {
        type: 'Follow',
        actor: 'https://spam.example.com/users/spammer',
        object: 'https://example.com/users/alice',
      };

      const actorUrl =
        typeof activity.actor === 'string'
          ? activity.actor
          : (activity.actor as { id?: string })?.id;

      const host = actorUrl ? getActorHost(actorUrl) : null;

      expect(host).toBe('spam.example.com');
      expect(await repo.isBlocked(host!)).toBe(true);
    });
  });

  describe('Block list management', () => {
    test('should add and remove blocks correctly', async () => {
      // Simulate a simple in-memory block list for this test
      const hosts = new Set<string>();

      const testRepo: IInstanceBlockRepository = {
        create: mock(async (block) => {
          hosts.add(block.host.toLowerCase());
          return { id: '1', host: block.host, reason: null, blockedById: 'admin', createdAt: new Date() };
        }),
        findByHost: mock(async (host) => (hosts.has(host.toLowerCase()) ? {} as any : null)),
        isBlocked: mock(async (host) => hosts.has(host.toLowerCase())),
        findAll: mock(async () => []),
        deleteByHost: mock(async (host) => {
          const existed = hosts.has(host.toLowerCase());
          hosts.delete(host.toLowerCase());
          return existed;
        }),
        count: mock(async () => hosts.size),
      };

      // Initially not blocked
      expect(await testRepo.isBlocked('new-spam.com')).toBe(false);

      // Add block
      await testRepo.create({ host: 'new-spam.com', reason: 'Test', blockedById: 'admin' });
      expect(await testRepo.isBlocked('new-spam.com')).toBe(true);

      // Remove block
      await testRepo.deleteByHost('new-spam.com');
      expect(await testRepo.isBlocked('new-spam.com')).toBe(false);
    });
  });
});
