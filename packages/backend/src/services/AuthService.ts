/**
 * Authentication Service
 *
 * Provides user registration, login, logout, and session management.
 * Passwords are hashed with Argon2id, and sessions are managed with cryptographically secure tokens.
 *
 * @module services/AuthService
 */

import type { IUserRepository } from '../interfaces/repositories/IUserRepository.js';
import type { ISessionRepository } from '../interfaces/repositories/ISessionRepository.js';
import type { User, Session } from 'shared';
import { hashPassword, verifyPassword } from '../utils/password.js';
import { generateSessionToken, calculateSessionExpiry } from '../utils/session.js';
import { generateId } from 'shared';
import { generateKeyPair } from '../utils/crypto.js';

/**
 * User Registration Input Data
 */
export interface RegisterInput {
  /** Username (3-20 characters, alphanumeric and underscores only) */
  username: string;
  /** Email address */
  email: string;
  /** Password (minimum 8 characters) */
  password: string;
  /** Display name (defaults to username if omitted) */
  name?: string;
}

/**
 * Login Input Data
 */
export interface LoginInput {
  /** Username */
  username: string;
  /** Password */
  password: string;
}

/**
 * Authentication Service
 *
 * Provides business logic related to user authentication.
 */
export class AuthService {
  /**
   * AuthService Constructor
   *
   * @param userRepository - User repository
   * @param sessionRepository - Session repository
   */
  constructor(
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository
  ) {}

  /**
   * Register New User
   *
   * Checks for duplicate username and email, hashes the password, and creates the user.
   * Automatically creates and returns a session upon successful registration.
   *
   * @param input - User registration information
   * @returns Created user and session
   * @throws When username or email already exists
   *
   * @example
   * ```typescript
   * const { user, session } = await authService.register({
   *   username: 'alice',
   *   email: 'alice@example.com',
   *   password: 'securePassword123',
   *   name: 'Alice Smith'
   * });
   * ```
   */
  async register(input: RegisterInput): Promise<{ user: User; session: Session }> {
    // ユーザー名の重複チェック
    const existingUsername = await this.userRepository.findByUsername(input.username);
    if (existingUsername) {
      throw new Error('Username already exists');
    }

    // メールアドレスの重複チェック
    const existingEmail = await this.userRepository.findByEmail(input.email);
    if (existingEmail) {
      throw new Error('Email already exists');
    }

    // パスワードをハッシュ化
    const passwordHash = await hashPassword(input.password);

    // ActivityPub用の鍵ペア生成（ローカルユーザー用）
    const { publicKey, privateKey } = generateKeyPair();

    // ユーザー作成
    const baseUrl = process.env.URL || 'http://localhost:3000';
    const user = await this.userRepository.create({
      id: generateId(),
      username: input.username,
      email: input.email,
      passwordHash,
      displayName: input.name || input.username,
      host: null, // ローカルユーザー
      avatarUrl: null,
      bannerUrl: null,
      bio: null,
      isAdmin: false,
      isSuspended: false,
      publicKey,
      privateKey,
      customCss: null, // Custom CSS for profile page
      // ActivityPub fields for local users
      inbox: `${baseUrl}/users/${input.username}/inbox`,
      outbox: `${baseUrl}/users/${input.username}/outbox`,
      followersUrl: `${baseUrl}/users/${input.username}/followers`,
      followingUrl: `${baseUrl}/users/${input.username}/following`,
      uri: `${baseUrl}/users/${input.username}`,
      sharedInbox: null, // Local users don't have shared inbox
    });

    // セッション作成
    const session = await this.createSession(user.id);

    return { user, session };
  }

  /**
   * User Login
   *
   * Validates username and password, and creates a new session upon success.
   * Throws an error if the account is suspended.
   *
   * @param input - Login information (username and password)
   * @returns User and newly created session
   * @throws When username or password is invalid, or when account is suspended
   *
   * @example
   * ```typescript
   * const { user, session } = await authService.login({
   *   username: 'alice',
   *   password: 'securePassword123'
   * });
   * ```
   */
  async login(input: LoginInput): Promise<{ user: User; session: Session }> {
    // ユーザー検索
    const user = await this.userRepository.findByUsername(input.username);
    if (!user) {
      throw new Error('Invalid username or password');
    }

    // パスワード検証
    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid username or password');
    }

    // アカウント停止チェック
    if (user.isSuspended) {
      throw new Error('Account is suspended');
    }

    // セッション作成
    const session = await this.createSession(user.id);

    return { user, session };
  }

  /**
   * User Logout
   *
   * Deletes the session for the specified token.
   *
   * @param token - Token of the session to delete
   *
   * @example
   * ```typescript
   * await authService.logout(sessionToken);
   * ```
   */
  async logout(token: string): Promise<void> {
    await this.sessionRepository.deleteByToken(token);
  }

  /**
   * Validate Session
   *
   * Verifies the validity of a session token and returns user and session information if valid.
   * Returns null if the session doesn't exist, is expired, or the user is suspended.
   *
   * @param token - Session token to validate
   * @returns User and session if valid, null if invalid
   *
   * @example
   * ```typescript
   * const result = await authService.validateSession(token);
   * if (result) {
   *   const { user, session } = result;
   *   // Session valid
   * } else {
   *   // Session invalid - re-login required
   * }
   * ```
   */
  async validateSession(token: string): Promise<{ user: User; session: Session } | null> {
    const session = await this.sessionRepository.findByToken(token);
    if (!session) {
      return null;
    }

    // 有効期限チェック
    if (new Date() > session.expiresAt) {
      await this.sessionRepository.delete(token);
      return null;
    }

    const user = await this.userRepository.findById(session.userId);
    if (!user) {
      await this.sessionRepository.delete(token);
      return null;
    }

    // アカウント停止チェック
    if (user.isSuspended) {
      await this.sessionRepository.delete(token);
      return null;
    }

    return { user, session };
  }

  /**
   * Create Session (Internal Method)
   */
  private async createSession(userId: string): Promise<Session> {
    const sessionExpiryDays = Number.parseInt(process.env.SESSION_EXPIRY_DAYS || '30', 10);

    const session = await this.sessionRepository.create({
      id: generateId(),
      userId,
      token: generateSessionToken(),
      expiresAt: calculateSessionExpiry(sessionExpiryDays),
      userAgent: null,
      ipAddress: null,
    });

    return session;
  }
}
