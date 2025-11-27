/**
 * InboxService Unit Tests
 *
 * Tests the ActivityPub inbox dispatcher service including
 * handler registration and activity routing.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import {
  InboxService,
  getInboxService,
  resetInboxService,
} from '../../services/ap/inbox/InboxService';
import type { IActivityHandler } from '../../services/ap/inbox/types';

describe('InboxService', () => {
  beforeEach(() => {
    // Reset singleton for each test
    resetInboxService();
  });

  describe('constructor', () => {
    test('should register default handlers', () => {
      const service = new InboxService();
      const supportedTypes = service.getSupportedActivityTypes();

      expect(supportedTypes).toContain('Follow');
      expect(supportedTypes).toContain('Accept');
      expect(supportedTypes).toContain('Reject');
      expect(supportedTypes).toContain('Create');
      expect(supportedTypes).toContain('Update');
      expect(supportedTypes).toContain('Delete');
      expect(supportedTypes).toContain('Like');
      expect(supportedTypes).toContain('Announce');
      expect(supportedTypes).toContain('Undo');
      expect(supportedTypes).toContain('Move');
    });

    test('should have 10 default handlers', () => {
      const service = new InboxService();
      const supportedTypes = service.getSupportedActivityTypes();

      expect(supportedTypes.length).toBe(10);
    });
  });

  describe('getHandler', () => {
    test('should return handler for registered type', () => {
      const service = new InboxService();

      const handler = service.getHandler('Follow');
      expect(handler).toBeDefined();
      expect(handler?.activityType).toBe('Follow');
    });

    test('should return undefined for unregistered type', () => {
      const service = new InboxService();

      const handler = service.getHandler('NonExistent');
      expect(handler).toBeUndefined();
    });
  });

  describe('registerHandler', () => {
    test('should register custom handler', () => {
      const service = new InboxService();

      const customHandler: IActivityHandler = {
        activityType: 'CustomActivity',
        handle: async () => ({ success: true, message: 'Custom handled' }),
      };

      service.registerHandler(customHandler);

      const handler = service.getHandler('CustomActivity');
      expect(handler).toBeDefined();
      expect(handler?.activityType).toBe('CustomActivity');
    });

    test('should override existing handler', () => {
      const service = new InboxService();

      const customFollowHandler: IActivityHandler = {
        activityType: 'Follow',
        handle: async () => ({ success: true, message: 'Custom Follow' }),
      };

      service.registerHandler(customFollowHandler);

      const handler = service.getHandler('Follow');
      expect(handler).toBe(customFollowHandler);
    });
  });

  describe('getSupportedActivityTypes', () => {
    test('should return array of activity types', () => {
      const service = new InboxService();
      const types = service.getSupportedActivityTypes();

      expect(Array.isArray(types)).toBe(true);
      expect(types.length).toBeGreaterThan(0);
    });
  });

  describe('singleton', () => {
    test('getInboxService should return same instance', () => {
      const instance1 = getInboxService();
      const instance2 = getInboxService();

      expect(instance1).toBe(instance2);
    });

    test('resetInboxService should create new instance', () => {
      const instance1 = getInboxService();
      resetInboxService();
      const instance2 = getInboxService();

      expect(instance1).not.toBe(instance2);
    });
  });
});
