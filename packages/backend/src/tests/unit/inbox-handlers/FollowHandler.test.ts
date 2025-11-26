/**
 * FollowHandler Unit Tests
 *
 * Tests the Follow activity handler including:
 * - Follow relationship creation
 * - Duplicate follow handling
 * - Accept activity delivery
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { FollowHandler } from '../../../services/ap/inbox/handlers/FollowHandler';
import type { Activity, HandlerContext } from '../../../services/ap/inbox/types';
import type { Context } from 'hono';

// Mock the ActivityDeliveryService
mock.module('../../../services/ap/ActivityDeliveryService', () => ({
  ActivityDeliveryService: class {
    createAcceptActivity = mock(() => ({
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Accept',
      actor: 'http://localhost:3000/users/localuser',
      object: {},
    }));
    deliver = mock(() => Promise.resolve());
  },
}));

describe('FollowHandler', () => {
  let handler: FollowHandler;
  let mockContext: HandlerContext;
  let mockFollowRepository: any;
  let mockUserRepository: any;
  let mockRemoteActorService: any;

  const createMockHonoContext = (): Partial<Context> => {
    const contextMap = new Map<string, any>();

    mockFollowRepository = {
      exists: mock(() => Promise.resolve(false)),
      create: mock(() => Promise.resolve({ id: 'follow-123' })),
      delete: mock(() => Promise.resolve()),
    };

    mockUserRepository = {
      findById: mock(() =>
        Promise.resolve({
          id: 'local-user-123',
          username: 'localuser',
          privateKey: 'mock-private-key',
        })
      ),
    };

    mockRemoteActorService = {
      resolveActor: mock(() =>
        Promise.resolve({
          id: 'remote-user-456',
          username: 'remoteuser',
          host: 'remote.example.com',
          inbox: 'https://remote.example.com/inbox',
        })
      ),
    };

    contextMap.set('followRepository', mockFollowRepository);
    contextMap.set('userRepository', mockUserRepository);
    contextMap.set('remoteActorService', mockRemoteActorService);

    return {
      get: (key: string) => contextMap.get(key),
    };
  };

  beforeEach(() => {
    handler = new FollowHandler();
    const honoContext = createMockHonoContext() as Context;

    mockContext = {
      c: honoContext,
      recipientId: 'local-user-123',
      baseUrl: 'http://localhost:3000',
    };
  });

  test('should have correct activity type', () => {
    expect(handler.activityType).toBe('Follow');
  });

  test('should create follow relationship for valid Follow activity', async () => {
    const activity: Activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Follow',
      id: 'https://remote.example.com/activities/follow-1',
      actor: 'https://remote.example.com/users/remoteuser',
      object: 'http://localhost:3000/users/localuser',
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(mockRemoteActorService.resolveActor).toHaveBeenCalled();
    expect(mockFollowRepository.exists).toHaveBeenCalledWith('remote-user-456', 'local-user-123');
    expect(mockFollowRepository.create).toHaveBeenCalled();
  });

  test('should skip if follow already exists', async () => {
    mockFollowRepository.exists = mock(() => Promise.resolve(true));

    const activity: Activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Follow',
      id: 'https://remote.example.com/activities/follow-1',
      actor: 'https://remote.example.com/users/remoteuser',
      object: 'http://localhost:3000/users/localuser',
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Follow already exists');
    expect(mockFollowRepository.create).not.toHaveBeenCalled();
  });

  test('should handle actor resolution failure', async () => {
    // Create new context with failing mock
    const contextMap = new Map<string, any>();
    const failingRemoteActorService = {
      resolveActor: mock(async () => {
        throw new Error('Actor resolution failed');
      }),
    };
    contextMap.set('followRepository', mockFollowRepository);
    contextMap.set('userRepository', mockUserRepository);
    contextMap.set('remoteActorService', failingRemoteActorService);

    const failingContext: HandlerContext = {
      c: { get: (key: string) => contextMap.get(key) } as Context,
      recipientId: 'local-user-123',
      baseUrl: 'http://localhost:3000',
    };

    const activity: Activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Follow',
      id: 'https://remote.example.com/activities/follow-1',
      actor: 'https://remote.example.com/users/remoteuser',
      object: 'http://localhost:3000/users/localuser',
    };

    const result = await handler.handle(activity, failingContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain('Failed to handle Follow activity');
  });

  test('should handle missing recipient private key', async () => {
    mockUserRepository.findById = mock(() =>
      Promise.resolve({
        id: 'local-user-123',
        username: 'localuser',
        privateKey: null,
      })
    );

    const activity: Activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Follow',
      id: 'https://remote.example.com/activities/follow-1',
      actor: 'https://remote.example.com/users/remoteuser',
      object: 'http://localhost:3000/users/localuser',
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain('private key');
  });

  test('should handle missing remote actor inbox', async () => {
    mockRemoteActorService.resolveActor = mock(() =>
      Promise.resolve({
        id: 'remote-user-456',
        username: 'remoteuser',
        host: 'remote.example.com',
        inbox: null,
      })
    );

    const activity: Activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Follow',
      id: 'https://remote.example.com/activities/follow-1',
      actor: 'https://remote.example.com/users/remoteuser',
      object: 'http://localhost:3000/users/localuser',
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(false);
    expect(result.message).toContain('inbox');
  });

  test('should handle actor object format', async () => {
    const activity: Activity = {
      '@context': 'https://www.w3.org/ns/activitystreams',
      type: 'Follow',
      id: 'https://remote.example.com/activities/follow-1',
      actor: {
        id: 'https://remote.example.com/users/remoteuser',
        type: 'Person',
      },
      object: 'http://localhost:3000/users/localuser',
    };

    const result = await handler.handle(activity, mockContext);

    expect(result.success).toBe(true);
    expect(mockRemoteActorService.resolveActor).toHaveBeenCalledWith(
      'https://remote.example.com/users/remoteuser'
    );
  });
});
