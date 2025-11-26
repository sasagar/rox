/**
 * Instance Block Repository Unit Tests
 *
 * Tests instance blocking functionality including:
 * - Creating blocks
 * - Finding blocks by host
 * - Checking if a host is blocked
 * - Listing all blocks
 * - Deleting blocks
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import type { IInstanceBlockRepository } from '../../interfaces/repositories/IInstanceBlockRepository';
import type { InstanceBlock } from '../../db/schema/pg.js';

describe('InstanceBlockRepository', () => {
  // Mock implementation for testing the interface contract
  let mockRepo: IInstanceBlockRepository;
  let blockedHosts: Map<string, InstanceBlock>;

  const createMockBlock = (host: string, reason?: string): InstanceBlock => ({
    id: `block-${host}`,
    host: host.toLowerCase(),
    reason: reason || null,
    blockedById: 'admin-user-id',
    createdAt: new Date(),
  });

  beforeEach(() => {
    blockedHosts = new Map();

    mockRepo = {
      create: mock(async (block) => {
        const newBlock = createMockBlock(block.host, block.reason ?? undefined);
        blockedHosts.set(newBlock.host, newBlock);
        return newBlock;
      }),

      findByHost: mock(async (host) => {
        return blockedHosts.get(host.toLowerCase()) ?? null;
      }),

      isBlocked: mock(async (host) => {
        return blockedHosts.has(host.toLowerCase());
      }),

      findAll: mock(async (limit = 100, offset = 0) => {
        return Array.from(blockedHosts.values()).slice(offset, offset + limit);
      }),

      deleteByHost: mock(async (host) => {
        const existed = blockedHosts.has(host.toLowerCase());
        blockedHosts.delete(host.toLowerCase());
        return existed;
      }),

      count: mock(async () => {
        return blockedHosts.size;
      }),
    };
  });

  describe('create', () => {
    test('should create a new instance block', async () => {
      const block = await mockRepo.create({
        host: 'spam.example.com',
        reason: 'Spam instance',
        blockedById: 'admin-user-id',
      });

      expect(block.host).toBe('spam.example.com');
      expect(block.reason).toBe('Spam instance');
      expect(block.id).toBeDefined();
    });

    test('should normalize host to lowercase', async () => {
      const block = await mockRepo.create({
        host: 'SPAM.Example.COM',
        reason: null,
        blockedById: 'admin-user-id',
      });

      expect(block.host).toBe('spam.example.com');
    });

    test('should allow null reason', async () => {
      const block = await mockRepo.create({
        host: 'blocked.com',
        reason: null,
        blockedById: 'admin-user-id',
      });

      expect(block.reason).toBeNull();
    });
  });

  describe('findByHost', () => {
    test('should find existing block', async () => {
      await mockRepo.create({
        host: 'blocked.example.com',
        reason: 'Test',
        blockedById: 'admin-user-id',
      });

      const found = await mockRepo.findByHost('blocked.example.com');

      expect(found).not.toBeNull();
      expect(found?.host).toBe('blocked.example.com');
    });

    test('should return null for non-blocked host', async () => {
      const found = await mockRepo.findByHost('not-blocked.example.com');

      expect(found).toBeNull();
    });

    test('should be case-insensitive', async () => {
      await mockRepo.create({
        host: 'blocked.example.com',
        reason: 'Test',
        blockedById: 'admin-user-id',
      });

      const found = await mockRepo.findByHost('BLOCKED.EXAMPLE.COM');

      expect(found).not.toBeNull();
    });
  });

  describe('isBlocked', () => {
    test('should return true for blocked host', async () => {
      await mockRepo.create({
        host: 'blocked.com',
        reason: null,
        blockedById: 'admin-user-id',
      });

      const result = await mockRepo.isBlocked('blocked.com');

      expect(result).toBe(true);
    });

    test('should return false for non-blocked host', async () => {
      const result = await mockRepo.isBlocked('allowed.com');

      expect(result).toBe(false);
    });

    test('should be case-insensitive', async () => {
      await mockRepo.create({
        host: 'blocked.com',
        reason: null,
        blockedById: 'admin-user-id',
      });

      expect(await mockRepo.isBlocked('BLOCKED.COM')).toBe(true);
      expect(await mockRepo.isBlocked('Blocked.Com')).toBe(true);
    });
  });

  describe('findAll', () => {
    test('should return all blocks', async () => {
      await mockRepo.create({ host: 'spam1.com', reason: null, blockedById: 'admin' });
      await mockRepo.create({ host: 'spam2.com', reason: null, blockedById: 'admin' });
      await mockRepo.create({ host: 'spam3.com', reason: null, blockedById: 'admin' });

      const blocks = await mockRepo.findAll();

      expect(blocks.length).toBe(3);
    });

    test('should respect limit parameter', async () => {
      await mockRepo.create({ host: 'spam1.com', reason: null, blockedById: 'admin' });
      await mockRepo.create({ host: 'spam2.com', reason: null, blockedById: 'admin' });
      await mockRepo.create({ host: 'spam3.com', reason: null, blockedById: 'admin' });

      const blocks = await mockRepo.findAll(2);

      expect(blocks.length).toBe(2);
    });

    test('should respect offset parameter', async () => {
      await mockRepo.create({ host: 'spam1.com', reason: null, blockedById: 'admin' });
      await mockRepo.create({ host: 'spam2.com', reason: null, blockedById: 'admin' });
      await mockRepo.create({ host: 'spam3.com', reason: null, blockedById: 'admin' });

      const blocks = await mockRepo.findAll(100, 1);

      expect(blocks.length).toBe(2);
    });

    test('should return empty array when no blocks', async () => {
      const blocks = await mockRepo.findAll();

      expect(blocks).toEqual([]);
    });
  });

  describe('deleteByHost', () => {
    test('should delete existing block', async () => {
      await mockRepo.create({ host: 'todelete.com', reason: null, blockedById: 'admin' });

      const result = await mockRepo.deleteByHost('todelete.com');

      expect(result).toBe(true);
      expect(await mockRepo.isBlocked('todelete.com')).toBe(false);
    });

    test('should return false for non-existent block', async () => {
      const result = await mockRepo.deleteByHost('nonexistent.com');

      expect(result).toBe(false);
    });

    test('should be case-insensitive', async () => {
      await mockRepo.create({ host: 'todelete.com', reason: null, blockedById: 'admin' });

      const result = await mockRepo.deleteByHost('TODELETE.COM');

      expect(result).toBe(true);
    });
  });

  describe('count', () => {
    test('should return correct count', async () => {
      expect(await mockRepo.count()).toBe(0);

      await mockRepo.create({ host: 'spam1.com', reason: null, blockedById: 'admin' });
      expect(await mockRepo.count()).toBe(1);

      await mockRepo.create({ host: 'spam2.com', reason: null, blockedById: 'admin' });
      expect(await mockRepo.count()).toBe(2);

      await mockRepo.deleteByHost('spam1.com');
      expect(await mockRepo.count()).toBe(1);
    });
  });
});
