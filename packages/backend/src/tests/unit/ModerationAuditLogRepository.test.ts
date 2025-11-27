/**
 * ModerationAuditLogRepository Unit Tests
 *
 * Tests moderation audit log repository including creation,
 * querying, and filtering of audit log entries
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import type { IModerationAuditLogRepository } from '../../interfaces/repositories/IModerationAuditLogRepository.js';
import type { ModerationAuditLog } from '../../db/schema/pg.js';

/**
 * Mock implementation of IModerationAuditLogRepository for testing
 */
class MockModerationAuditLogRepository implements IModerationAuditLogRepository {
  private logs: ModerationAuditLog[] = [];

  async create(data: {
    moderatorId: string;
    action: any;
    targetType: any;
    targetId: string;
    reason?: string;
    details?: Record<string, unknown>;
  }): Promise<ModerationAuditLog> {
    const log: ModerationAuditLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      moderatorId: data.moderatorId,
      action: data.action,
      targetType: data.targetType,
      targetId: data.targetId,
      reason: data.reason ?? null,
      details: data.details ?? null,
      createdAt: new Date(),
    };
    this.logs.push(log);
    return log;
  }

  async findById(id: string): Promise<ModerationAuditLog | null> {
    return this.logs.find((log) => log.id === id) ?? null;
  }

  async findAll(options?: {
    moderatorId?: string;
    action?: any;
    targetType?: any;
    targetId?: string;
    limit?: number;
    offset?: number;
  }): Promise<ModerationAuditLog[]> {
    let filtered = [...this.logs];

    if (options?.moderatorId) {
      filtered = filtered.filter((log) => log.moderatorId === options.moderatorId);
    }
    if (options?.action) {
      filtered = filtered.filter((log) => log.action === options.action);
    }
    if (options?.targetType) {
      filtered = filtered.filter((log) => log.targetType === options.targetType);
    }
    if (options?.targetId) {
      filtered = filtered.filter((log) => log.targetId === options.targetId);
    }

    // Sort by createdAt descending
    filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const offset = options?.offset ?? 0;
    const limit = options?.limit ?? 100;

    return filtered.slice(offset, offset + limit);
  }

  async count(options?: {
    moderatorId?: string;
    action?: any;
    targetType?: any;
    targetId?: string;
  }): Promise<number> {
    let filtered = [...this.logs];

    if (options?.moderatorId) {
      filtered = filtered.filter((log) => log.moderatorId === options.moderatorId);
    }
    if (options?.action) {
      filtered = filtered.filter((log) => log.action === options.action);
    }
    if (options?.targetType) {
      filtered = filtered.filter((log) => log.targetType === options.targetType);
    }
    if (options?.targetId) {
      filtered = filtered.filter((log) => log.targetId === options.targetId);
    }

    return filtered.length;
  }

  async findByTarget(
    targetType: any,
    targetId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ModerationAuditLog[]> {
    return this.findAll({ targetType, targetId, ...options });
  }

  async findByModerator(
    moderatorId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ModerationAuditLog[]> {
    return this.findAll({ moderatorId, ...options });
  }

  // Test helper to clear logs
  clear(): void {
    this.logs = [];
  }

  // Test helper to get all logs
  getAll(): ModerationAuditLog[] {
    return [...this.logs];
  }
}

describe('ModerationAuditLogRepository', () => {
  let repo: MockModerationAuditLogRepository;

  beforeEach(() => {
    repo = new MockModerationAuditLogRepository();
  });

  describe('create', () => {
    test('should create audit log entry with all fields', async () => {
      const log = await repo.create({
        moderatorId: 'mod-123',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-456',
        reason: 'Spam content',
        details: { originalText: 'Buy cheap watches!' },
      });

      expect(log.id).toBeDefined();
      expect(log.moderatorId).toBe('mod-123');
      expect(log.action).toBe('delete_note');
      expect(log.targetType).toBe('note');
      expect(log.targetId).toBe('note-456');
      expect(log.reason).toBe('Spam content');
      expect(log.details).toEqual({ originalText: 'Buy cheap watches!' });
      expect(log.createdAt).toBeInstanceOf(Date);
    });

    test('should create audit log entry without optional fields', async () => {
      const log = await repo.create({
        moderatorId: 'mod-123',
        action: 'suspend_user',
        targetType: 'user',
        targetId: 'user-789',
      });

      expect(log.id).toBeDefined();
      expect(log.moderatorId).toBe('mod-123');
      expect(log.reason).toBeNull();
      expect(log.details).toBeNull();
    });

    test('should create multiple distinct log entries', async () => {
      const log1 = await repo.create({
        moderatorId: 'mod-123',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-1',
      });

      const log2 = await repo.create({
        moderatorId: 'mod-123',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-2',
      });

      expect(log1.id).not.toBe(log2.id);
      expect(repo.getAll()).toHaveLength(2);
    });
  });

  describe('findById', () => {
    test('should find existing log by ID', async () => {
      const created = await repo.create({
        moderatorId: 'mod-123',
        action: 'suspend_user',
        targetType: 'user',
        targetId: 'user-456',
      });

      const found = await repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.moderatorId).toBe('mod-123');
    });

    test('should return null for non-existent ID', async () => {
      const found = await repo.findById('non-existent-id');

      expect(found).toBeNull();
    });
  });

  describe('findAll', () => {
    beforeEach(async () => {
      // Create test data
      await repo.create({
        moderatorId: 'mod-1',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-1',
      });
      await repo.create({
        moderatorId: 'mod-1',
        action: 'suspend_user',
        targetType: 'user',
        targetId: 'user-1',
      });
      await repo.create({
        moderatorId: 'mod-2',
        action: 'resolve_report',
        targetType: 'report',
        targetId: 'report-1',
      });
      await repo.create({
        moderatorId: 'mod-2',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-2',
      });
    });

    test('should return all logs without filters', async () => {
      const logs = await repo.findAll();

      expect(logs).toHaveLength(4);
    });

    test('should filter by moderatorId', async () => {
      const logs = await repo.findAll({ moderatorId: 'mod-1' });

      expect(logs).toHaveLength(2);
      logs.forEach((log) => expect(log.moderatorId).toBe('mod-1'));
    });

    test('should filter by action', async () => {
      const logs = await repo.findAll({ action: 'delete_note' });

      expect(logs).toHaveLength(2);
      logs.forEach((log) => expect(log.action).toBe('delete_note'));
    });

    test('should filter by targetType', async () => {
      const logs = await repo.findAll({ targetType: 'note' });

      expect(logs).toHaveLength(2);
      logs.forEach((log) => expect(log.targetType).toBe('note'));
    });

    test('should filter by targetId', async () => {
      const logs = await repo.findAll({ targetId: 'note-1' });

      expect(logs).toHaveLength(1);
      expect(logs[0]?.targetId).toBe('note-1');
    });

    test('should combine multiple filters', async () => {
      const logs = await repo.findAll({
        moderatorId: 'mod-2',
        action: 'delete_note',
      });

      expect(logs).toHaveLength(1);
      expect(logs[0]?.moderatorId).toBe('mod-2');
      expect(logs[0]?.action).toBe('delete_note');
    });

    test('should respect limit parameter', async () => {
      const logs = await repo.findAll({ limit: 2 });

      expect(logs).toHaveLength(2);
    });

    test('should respect offset parameter', async () => {
      const allLogs = await repo.findAll();
      const offsetLogs = await repo.findAll({ offset: 2 });

      expect(offsetLogs).toHaveLength(2);
      expect(offsetLogs[0]?.id).toBe(allLogs[2]?.id);
    });

    test('should return empty array when no matches', async () => {
      const logs = await repo.findAll({ moderatorId: 'non-existent' });

      expect(logs).toHaveLength(0);
    });
  });

  describe('count', () => {
    beforeEach(async () => {
      await repo.create({
        moderatorId: 'mod-1',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-1',
      });
      await repo.create({
        moderatorId: 'mod-1',
        action: 'suspend_user',
        targetType: 'user',
        targetId: 'user-1',
      });
      await repo.create({
        moderatorId: 'mod-2',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-2',
      });
    });

    test('should count all logs without filters', async () => {
      const count = await repo.count();

      expect(count).toBe(3);
    });

    test('should count with moderatorId filter', async () => {
      const count = await repo.count({ moderatorId: 'mod-1' });

      expect(count).toBe(2);
    });

    test('should count with action filter', async () => {
      const count = await repo.count({ action: 'delete_note' });

      expect(count).toBe(2);
    });

    test('should return 0 when no matches', async () => {
      const count = await repo.count({ moderatorId: 'non-existent' });

      expect(count).toBe(0);
    });
  });

  describe('findByTarget', () => {
    beforeEach(async () => {
      await repo.create({
        moderatorId: 'mod-1',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-1',
        reason: 'First deletion',
      });
      await repo.create({
        moderatorId: 'mod-2',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-1',
        reason: 'Second deletion (restored then deleted again)',
      });
      await repo.create({
        moderatorId: 'mod-1',
        action: 'suspend_user',
        targetType: 'user',
        targetId: 'user-1',
      });
    });

    test('should find all logs for a specific target', async () => {
      const logs = await repo.findByTarget('note', 'note-1');

      expect(logs).toHaveLength(2);
      logs.forEach((log) => {
        expect(log.targetType).toBe('note');
        expect(log.targetId).toBe('note-1');
      });
    });

    test('should return empty array for non-existent target', async () => {
      const logs = await repo.findByTarget('note', 'non-existent');

      expect(logs).toHaveLength(0);
    });
  });

  describe('findByModerator', () => {
    beforeEach(async () => {
      await repo.create({
        moderatorId: 'mod-1',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-1',
      });
      await repo.create({
        moderatorId: 'mod-1',
        action: 'suspend_user',
        targetType: 'user',
        targetId: 'user-1',
      });
      await repo.create({
        moderatorId: 'mod-2',
        action: 'delete_note',
        targetType: 'note',
        targetId: 'note-2',
      });
    });

    test('should find all logs by a specific moderator', async () => {
      const logs = await repo.findByModerator('mod-1');

      expect(logs).toHaveLength(2);
      logs.forEach((log) => {
        expect(log.moderatorId).toBe('mod-1');
      });
    });

    test('should return empty array for non-existent moderator', async () => {
      const logs = await repo.findByModerator('non-existent');

      expect(logs).toHaveLength(0);
    });

    test('should respect limit parameter', async () => {
      const logs = await repo.findByModerator('mod-1', { limit: 1 });

      expect(logs).toHaveLength(1);
    });
  });
});

describe('ModerationAction types', () => {
  let repo: MockModerationAuditLogRepository;

  beforeEach(() => {
    repo = new MockModerationAuditLogRepository();
  });

  test('should support delete_note action', async () => {
    const log = await repo.create({
      moderatorId: 'mod-1',
      action: 'delete_note',
      targetType: 'note',
      targetId: 'note-1',
    });

    expect(log.action).toBe('delete_note');
  });

  test('should support suspend_user action', async () => {
    const log = await repo.create({
      moderatorId: 'mod-1',
      action: 'suspend_user',
      targetType: 'user',
      targetId: 'user-1',
    });

    expect(log.action).toBe('suspend_user');
  });

  test('should support unsuspend_user action', async () => {
    const log = await repo.create({
      moderatorId: 'mod-1',
      action: 'unsuspend_user',
      targetType: 'user',
      targetId: 'user-1',
    });

    expect(log.action).toBe('unsuspend_user');
  });

  test('should support resolve_report action', async () => {
    const log = await repo.create({
      moderatorId: 'mod-1',
      action: 'resolve_report',
      targetType: 'report',
      targetId: 'report-1',
    });

    expect(log.action).toBe('resolve_report');
  });

  test('should support reject_report action', async () => {
    const log = await repo.create({
      moderatorId: 'mod-1',
      action: 'reject_report',
      targetType: 'report',
      targetId: 'report-1',
    });

    expect(log.action).toBe('reject_report');
  });

  test('should support block_instance action', async () => {
    const log = await repo.create({
      moderatorId: 'mod-1',
      action: 'block_instance',
      targetType: 'instance',
      targetId: 'spam.example.com',
    });

    expect(log.action).toBe('block_instance');
  });
});
