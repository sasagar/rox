/**
 * FollowService Unit Tests
 *
 * Tests business logic for follow/unfollow operations including
 * validation, federation delivery, and relationship queries
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { FollowService } from '../../services/FollowService';
import type { IFollowRepository } from '../../interfaces/repositories/IFollowRepository';
import type { IUserRepository } from '../../interfaces/repositories/IUserRepository';
import type { ActivityPubDeliveryService } from '../../services/ap/ActivityPubDeliveryService';
import type { Follow } from 'shared';
import type { User } from '../../db/schema/pg.js';

/**
 * Partial mock types that only include the methods we actually use in tests
 */
type MockFollowRepo = Pick<
  IFollowRepository,
  'create' | 'delete' | 'exists' | 'findByFollowerId' | 'findByFolloweeId' | 'countFollowers' | 'countFollowing'
>;
type MockUserRepo = Pick<IUserRepository, 'findById'>;
type MockDeliveryService = Pick<ActivityPubDeliveryService, 'deliverFollow' | 'deliverUndoFollow'>;

describe('FollowService', () => {
  // Mock data
  const mockLocalUser: Partial<User> = {
    id: 'user1',
    username: 'localuser',
    host: null, // Local user
    displayName: 'Local User',
    privateKey: 'mock-private-key',
    inbox: null,
  };

  const mockRemoteUser: Partial<User> = {
    id: 'user2',
    username: 'remoteuser',
    host: 'remote.example.com', // Remote user
    displayName: 'Remote User',
    privateKey: null,
    inbox: 'https://remote.example.com/users/remoteuser/inbox',
  };

  const mockFollow: Follow = {
    id: 'follow1',
    followerId: 'user1',
    followeeId: 'user2',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock repositories
  let mockFollowRepo: MockFollowRepo;
  let mockUserRepo: MockUserRepo;
  let mockDeliveryService: MockDeliveryService;

  beforeEach(() => {
    mockFollowRepo = {
      create: mock(() => Promise.resolve(mockFollow)),
      delete: mock(() => Promise.resolve()),
      exists: mock(() => Promise.resolve(false)),
      findByFollowerId: mock(() => Promise.resolve([mockFollow])),
      findByFolloweeId: mock(() => Promise.resolve([mockFollow])),
      countFollowers: mock(() => Promise.resolve(10)),
      countFollowing: mock(() => Promise.resolve(5)),
    };

    mockUserRepo = {
      findById: mock((id: string) => {
        if (id === 'user1') return Promise.resolve(mockLocalUser as User);
        if (id === 'user2') return Promise.resolve(mockRemoteUser as User);
        return Promise.resolve(null);
      }),
    };

    mockDeliveryService = {
      deliverFollow: mock(() => Promise.resolve(null)),
      deliverUndoFollow: mock(() => Promise.resolve()),
    };
  });

  describe('follow', () => {
    test('should create a follow relationship', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      const result = await service.follow('user1', 'user2');

      expect(result.id).toBe('follow1');
      expect(mockFollowRepo.create).toHaveBeenCalled();
    });

    test('should reject following oneself', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await expect(service.follow('user1', 'user1')).rejects.toThrow(
        'Cannot follow yourself'
      );
    });

    test('should reject if follower not found', async () => {
      const mockUserRepoNoFollower: MockUserRepo = {
        findById: mock((id: string) => {
          if (id === 'nonexistent') return Promise.resolve(null);
          return Promise.resolve(mockRemoteUser as User);
        }),
      };

      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepoNoFollower as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await expect(service.follow('nonexistent', 'user2')).rejects.toThrow(
        'Follower not found'
      );
    });

    test('should reject if followee not found', async () => {
      const mockUserRepoNoFollowee: MockUserRepo = {
        findById: mock((id: string) => {
          if (id === 'user1') return Promise.resolve(mockLocalUser as User);
          return Promise.resolve(null);
        }),
      };

      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepoNoFollowee as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await expect(service.follow('user1', 'nonexistent')).rejects.toThrow(
        'Followee not found'
      );
    });

    test('should reject if already following', async () => {
      const mockFollowRepoExists: MockFollowRepo = {
        ...mockFollowRepo,
        exists: mock(() => Promise.resolve(true)),
      };

      const service = new FollowService(
        mockFollowRepoExists as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await expect(service.follow('user1', 'user2')).rejects.toThrow(
        'Already following'
      );
    });

    test('should deliver Follow activity to remote users', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await service.follow('user1', 'user2');

      // Wait for fire-and-forget delivery
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockDeliveryService.deliverFollow).toHaveBeenCalledWith(
        mockLocalUser,
        mockRemoteUser
      );
    });

    test('should not deliver Follow activity to local users', async () => {
      const mockLocalFollowee: Partial<User> = { ...mockLocalUser, id: 'user3' };
      const mockUserRepoLocal: MockUserRepo = {
        findById: mock((id: string) => {
          if (id === 'user1') return Promise.resolve(mockLocalUser as User);
          if (id === 'user3') return Promise.resolve(mockLocalFollowee as User);
          return Promise.resolve(null);
        }),
      };

      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepoLocal as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await service.follow('user1', 'user3');

      // Wait for potential delivery
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockDeliveryService.deliverFollow).not.toHaveBeenCalled();
    });

    test('should work without delivery service', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository
        // No delivery service
      );

      const result = await service.follow('user1', 'user2');

      expect(result.id).toBe('follow1');
      // No delivery should occur
    });
  });

  describe('unfollow', () => {
    test('should delete a follow relationship', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await service.unfollow('user1', 'user2');

      expect(mockFollowRepo.delete).toHaveBeenCalledWith('user1', 'user2');
    });

    test('should deliver Undo Follow activity to remote users', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await service.unfollow('user1', 'user2');

      // Wait for fire-and-forget delivery
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockDeliveryService.deliverUndoFollow).toHaveBeenCalledWith(
        mockLocalUser,
        mockRemoteUser
      );
    });

    test('should not deliver Undo Follow activity to local users', async () => {
      const mockLocalFollowee: Partial<User> = { ...mockLocalUser, id: 'user3' };
      const mockUserRepoLocal: MockUserRepo = {
        findById: mock((id: string) => {
          if (id === 'user1') return Promise.resolve(mockLocalUser as User);
          if (id === 'user3') return Promise.resolve(mockLocalFollowee as User);
          return Promise.resolve(null);
        }),
      };

      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepoLocal as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await service.unfollow('user1', 'user3');

      // Wait for potential delivery
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockDeliveryService.deliverUndoFollow).not.toHaveBeenCalled();
    });

    test('should handle missing users gracefully', async () => {
      const mockUserRepoNull: MockUserRepo = {
        findById: mock(() => Promise.resolve(null)),
      };

      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepoNull as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      // Should not throw
      await service.unfollow('user1', 'user2');

      expect(mockFollowRepo.delete).toHaveBeenCalled();
      expect(mockDeliveryService.deliverUndoFollow).not.toHaveBeenCalled();
    });
  });

  describe('getFollowers', () => {
    test('should return followers list', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      const result = await service.getFollowers('user2');

      expect(result).toHaveLength(1);
      expect(mockFollowRepo.findByFolloweeId).toHaveBeenCalledWith(
        'user2',
        undefined
      );
    });

    test('should respect limit parameter', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await service.getFollowers('user2', 50);

      expect(mockFollowRepo.findByFolloweeId).toHaveBeenCalledWith('user2', 50);
    });
  });

  describe('getFollowing', () => {
    test('should return following list', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      const result = await service.getFollowing('user1');

      expect(result).toHaveLength(1);
      expect(mockFollowRepo.findByFollowerId).toHaveBeenCalledWith(
        'user1',
        undefined
      );
    });

    test('should respect limit parameter', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      await service.getFollowing('user1', 25);

      expect(mockFollowRepo.findByFollowerId).toHaveBeenCalledWith('user1', 25);
    });
  });

  describe('getFollowerCount', () => {
    test('should return follower count', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      const result = await service.getFollowerCount('user2');

      expect(result).toBe(10);
      expect(mockFollowRepo.countFollowers).toHaveBeenCalledWith('user2');
    });
  });

  describe('getFollowingCount', () => {
    test('should return following count', async () => {
      const service = new FollowService(
        mockFollowRepo as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      const result = await service.getFollowingCount('user1');

      expect(result).toBe(5);
      expect(mockFollowRepo.countFollowing).toHaveBeenCalledWith('user1');
    });
  });

  describe('isFollowing', () => {
    test('should return true when following', async () => {
      const mockFollowRepoExists: MockFollowRepo = {
        ...mockFollowRepo,
        exists: mock(() => Promise.resolve(true)),
      };

      const service = new FollowService(
        mockFollowRepoExists as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      const result = await service.isFollowing('user1', 'user2');

      expect(result).toBe(true);
      expect(mockFollowRepoExists.exists).toHaveBeenCalledWith('user1', 'user2');
    });

    test('should return false when not following', async () => {
      const mockFollowRepoNotExists: MockFollowRepo = {
        ...mockFollowRepo,
        exists: mock(() => Promise.resolve(false)),
      };

      const service = new FollowService(
        mockFollowRepoNotExists as IFollowRepository,
        mockUserRepo as IUserRepository,
        mockDeliveryService as ActivityPubDeliveryService
      );

      const result = await service.isFollowing('user1', 'user3');

      expect(result).toBe(false);
    });
  });
});
