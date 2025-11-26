/**
 * AuthService Unit Tests
 *
 * Tests authentication logic including registration, login,
 * logout, and session validation
 */

import { describe, test, expect, mock, beforeEach } from 'bun:test';
import { AuthService } from '../../services/AuthService';
import type { IUserRepository } from '../../interfaces/repositories/IUserRepository';
import type { ISessionRepository } from '../../interfaces/repositories/ISessionRepository';
import type { User } from '../../db/schema/pg.js';
import type { Session } from 'shared';

/**
 * Partial mock types that only include the methods we actually use in tests
 */
type MockUserRepo = Pick<IUserRepository, 'findByUsername' | 'findByEmail' | 'findById' | 'create'>;
type MockSessionRepo = Pick<ISessionRepository, 'create' | 'findByToken' | 'delete' | 'deleteByToken'>;

describe('AuthService', () => {
  // Mock data
  const mockUser: User = {
    id: 'user1',
    username: 'testuser',
    email: 'test@example.com',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$mock', // Mock hash
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
  };

  const mockSession: Session = {
    id: 'session1',
    userId: 'user1',
    token: 'mock-session-token-12345',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
    userAgent: null,
    ipAddress: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock repositories
  let mockUserRepo: MockUserRepo;
  let mockSessionRepo: MockSessionRepo;

  beforeEach(() => {
    mockUserRepo = {
      findByUsername: mock(() => Promise.resolve(null)),
      findByEmail: mock(() => Promise.resolve(null)),
      findById: mock(() => Promise.resolve(mockUser)),
      create: mock(() => Promise.resolve(mockUser)),
    };

    mockSessionRepo = {
      create: mock(() => Promise.resolve(mockSession)),
      findByToken: mock(() => Promise.resolve(mockSession)),
      delete: mock(() => Promise.resolve()),
      deleteByToken: mock(() => Promise.resolve()),
    };
  });

  describe('register', () => {
    test('should register a new user successfully', async () => {
      const service = new AuthService(
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      const result = await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'securePassword123',
        name: 'New User',
      });

      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(mockUserRepo.create).toHaveBeenCalled();
      expect(mockSessionRepo.create).toHaveBeenCalled();
    });

    test('should reject duplicate username', async () => {
      const mockUserRepoWithUser: MockUserRepo = {
        ...mockUserRepo,
        findByUsername: mock(() => Promise.resolve(mockUser)),
      };

      const service = new AuthService(
        mockUserRepoWithUser as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      await expect(
        service.register({
          username: 'testuser',
          email: 'another@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Username already exists');
    });

    test('should reject duplicate email', async () => {
      const mockUserRepoWithEmail: MockUserRepo = {
        ...mockUserRepo,
        findByEmail: mock(() => Promise.resolve(mockUser)),
      };

      const service = new AuthService(
        mockUserRepoWithEmail as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      await expect(
        service.register({
          username: 'anotheruser',
          email: 'test@example.com',
          password: 'password123',
        })
      ).rejects.toThrow('Email already exists');
    });

    test('should use username as displayName if name not provided', async () => {
      const service = new AuthService(
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      await service.register({
        username: 'newuser',
        email: 'new@example.com',
        password: 'securePassword123',
        // No name provided
      });

      // Check that create was called with displayName = username
      const createMock = mockUserRepo.create as ReturnType<typeof mock>;
      const createCall = createMock.mock.calls[0]?.[0] as Partial<User> | undefined;
      expect(createCall?.displayName).toBe('newuser');
    });
  });

  describe('login', () => {
    test('should login with valid credentials', async () => {
      // Mock user exists with valid password
      const hashedPassword = await Bun.password.hash('correctPassword', {
        algorithm: 'argon2id',
      });
      const userWithHash: User = { ...mockUser, passwordHash: hashedPassword };
      const mockUserRepoWithHash: MockUserRepo = {
        ...mockUserRepo,
        findByUsername: mock(() => Promise.resolve(userWithHash)),
      };

      const service = new AuthService(
        mockUserRepoWithHash as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      const result = await service.login({
        username: 'testuser',
        password: 'correctPassword',
      });

      expect(result.user).toBeDefined();
      expect(result.session).toBeDefined();
      expect(mockSessionRepo.create).toHaveBeenCalled();
    });

    test('should reject non-existent user', async () => {
      const mockUserRepoEmpty: MockUserRepo = {
        ...mockUserRepo,
        findByUsername: mock(() => Promise.resolve(null)),
      };

      const service = new AuthService(
        mockUserRepoEmpty as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      await expect(
        service.login({
          username: 'nonexistent',
          password: 'password123',
        })
      ).rejects.toThrow('Invalid username or password');
    });

    test('should reject wrong password', async () => {
      const hashedPassword = await Bun.password.hash('correctPassword', {
        algorithm: 'argon2id',
      });
      const userWithHash: User = { ...mockUser, passwordHash: hashedPassword };
      const mockUserRepoWithHash: MockUserRepo = {
        ...mockUserRepo,
        findByUsername: mock(() => Promise.resolve(userWithHash)),
      };

      const service = new AuthService(
        mockUserRepoWithHash as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      await expect(
        service.login({
          username: 'testuser',
          password: 'wrongPassword',
        })
      ).rejects.toThrow('Invalid username or password');
    });

    test('should reject suspended account', async () => {
      const hashedPassword = await Bun.password.hash('correctPassword', {
        algorithm: 'argon2id',
      });
      const suspendedUser: User = {
        ...mockUser,
        passwordHash: hashedPassword,
        isSuspended: true,
      };
      const mockUserRepoSuspended: MockUserRepo = {
        ...mockUserRepo,
        findByUsername: mock(() => Promise.resolve(suspendedUser)),
      };

      const service = new AuthService(
        mockUserRepoSuspended as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      await expect(
        service.login({
          username: 'testuser',
          password: 'correctPassword',
        })
      ).rejects.toThrow('Account is suspended');
    });
  });

  describe('logout', () => {
    test('should delete session on logout', async () => {
      const service = new AuthService(
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      await service.logout('mock-session-token');

      expect(mockSessionRepo.deleteByToken).toHaveBeenCalledWith(
        'mock-session-token'
      );
    });
  });

  describe('validateSession', () => {
    test('should return user and session for valid token', async () => {
      const service = new AuthService(
        mockUserRepo as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      const result = await service.validateSession('valid-token');

      expect(result).not.toBeNull();
      expect(result?.user.id).toBe('user1');
      expect(result?.session.token).toBe('mock-session-token-12345');
    });

    test('should return null for non-existent session', async () => {
      const mockSessionRepoEmpty: MockSessionRepo = {
        ...mockSessionRepo,
        findByToken: mock(() => Promise.resolve(null)),
      };

      const service = new AuthService(
        mockUserRepo as IUserRepository,
        mockSessionRepoEmpty as ISessionRepository
      );

      const result = await service.validateSession('invalid-token');

      expect(result).toBeNull();
    });

    test('should return null and delete expired session', async () => {
      const expiredSession: Session = {
        ...mockSession,
        expiresAt: new Date(Date.now() - 1000), // Expired 1 second ago
      };
      const mockSessionRepoExpired: MockSessionRepo = {
        ...mockSessionRepo,
        findByToken: mock(() => Promise.resolve(expiredSession)),
      };

      const service = new AuthService(
        mockUserRepo as IUserRepository,
        mockSessionRepoExpired as ISessionRepository
      );

      const result = await service.validateSession('expired-token');

      expect(result).toBeNull();
      expect(mockSessionRepoExpired.delete).toHaveBeenCalled();
    });

    test('should return null if user not found', async () => {
      const mockUserRepoEmpty: MockUserRepo = {
        ...mockUserRepo,
        findById: mock(() => Promise.resolve(null)),
      };

      const service = new AuthService(
        mockUserRepoEmpty as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      const result = await service.validateSession('valid-token');

      expect(result).toBeNull();
      expect(mockSessionRepo.delete).toHaveBeenCalled();
    });

    test('should return null and delete session if user is suspended', async () => {
      const suspendedUser: User = { ...mockUser, isSuspended: true };
      const mockUserRepoSuspended: MockUserRepo = {
        ...mockUserRepo,
        findById: mock(() => Promise.resolve(suspendedUser)),
      };

      const service = new AuthService(
        mockUserRepoSuspended as IUserRepository,
        mockSessionRepo as ISessionRepository
      );

      const result = await service.validateSession('valid-token');

      expect(result).toBeNull();
      expect(mockSessionRepo.delete).toHaveBeenCalled();
    });
  });
});
