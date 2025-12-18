/**
 * Authentication Service
 *
 * Provides user registration, login, logout, and session management.
 * Passwords are hashed with Argon2id, and sessions are managed with cryptographically secure tokens.
 *
 * @module services/AuthService
 */

import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { ISessionRepository } from "../interfaces/repositories/ISessionRepository.js";
import type { IEventBus } from "../interfaces/IEventBus.js";
import type { BlockedUsernameService } from "./BlockedUsernameService.js";
import type { User, Session } from "shared";
import { hashPassword, verifyPassword } from "../utils/password.js";
import { generateSessionToken, calculateSessionExpiry } from "../utils/session.js";
import { generateId } from "shared";
import { generateKeyPair } from "../utils/crypto.js";

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
  private readonly eventBus: IEventBus | null;

  /**
   * AuthService Constructor
   *
   * @param userRepository - User repository
   * @param sessionRepository - Session repository
   * @param blockedUsernameService - Optional blocked username service
   * @param eventBus - Optional event bus for plugin hooks
   */
  constructor(
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository,
    private blockedUsernameService?: BlockedUsernameService,
    eventBus?: IEventBus,
  ) {
    this.eventBus = eventBus ?? null;
  }

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
    let { username, email } = input;

    // Emit beforeRegister event (allows cancellation or modification)
    if (this.eventBus) {
      const beforeResult = await this.eventBus.emitBefore("user:beforeRegister", {
        username,
        email,
      });

      if (beforeResult.cancelled) {
        throw new Error(beforeResult.reason || "User registration was cancelled by a plugin");
      }

      // Apply modifications from plugins
      if (!beforeResult.cancelled && beforeResult.data) {
        username = beforeResult.data.username;
        email = beforeResult.data.email ?? email;
      }
    }

    // Check if username is blocked (reserved or custom pattern)
    if (this.blockedUsernameService) {
      const blockCheck = await this.blockedUsernameService.isUsernameBlocked(username);
      if (blockCheck.blocked) {
        throw new Error(blockCheck.reason || "This username is not allowed");
      }
    }

    // ユーザー名の重複チェック
    const existingUsername = await this.userRepository.findByUsername(username);
    if (existingUsername) {
      throw new Error("Username already exists");
    }

    // メールアドレスの重複チェック
    const existingEmail = await this.userRepository.findByEmail(email);
    if (existingEmail) {
      throw new Error("Email already exists");
    }

    // パスワードをハッシュ化
    const passwordHash = await hashPassword(input.password);

    // ActivityPub用の鍵ペア生成（ローカルユーザー用）
    const { publicKey, privateKey } = generateKeyPair();

    // Check if this is the first local user (make them admin)
    const localUserCount = await this.userRepository.count(true);
    const isFirstUser = localUserCount === 0;

    // ユーザー作成
    const baseUrl = process.env.URL || "http://localhost:3000";
    const user = await this.userRepository.create({
      id: generateId(),
      username,
      email,
      passwordHash,
      displayName: input.name || username,
      host: null, // ローカルユーザー
      avatarUrl: null,
      bannerUrl: null,
      bio: null,
      isAdmin: isFirstUser, // First user becomes admin
      isSuspended: false,
      isDeleted: false,
      deletedAt: null,
      isSystemUser: false,
      publicKey,
      privateKey,
      customCss: null, // Custom CSS for profile page
      uiSettings: null, // Default UI settings
      // ActivityPub fields for local users
      inbox: `${baseUrl}/users/${username}/inbox`,
      outbox: `${baseUrl}/users/${username}/outbox`,
      followersUrl: `${baseUrl}/users/${username}/followers`,
      followingUrl: `${baseUrl}/users/${username}/following`,
      uri: `${baseUrl}/users/${username}`,
      sharedInbox: null, // Local users don't have shared inbox
      // Account migration fields
      alsoKnownAs: [],
      movedTo: null,
      movedAt: null,
      // Profile emojis (for remote users)
      profileEmojis: [],
      // Storage quota (null means use role default)
      storageQuotaMb: null,
      // Remote actor fetch status (not applicable to local users)
      goneDetectedAt: null,
      fetchFailureCount: 0,
      lastFetchAttemptAt: null,
      lastFetchError: null,
      // Follower/following counts start at 0
      followersCount: 0,
      followingCount: 0,
    });

    // セッション作成
    const session = await this.createSession(user.id);

    // Emit afterRegister event (notification only, fire-and-forget)
    if (this.eventBus) {
      this.eventBus
        .emit("user:afterRegister", { userId: user.id, username: user.username })
        .catch(() => {
          // Silently ignore errors in notification-only events
        });
    }

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
      throw new Error("Invalid username or password");
    }

    // システムアカウントはログイン不可
    if (user.isSystemUser) {
      throw new Error("System account cannot be used for login");
    }

    // パスワード検証
    const isValid = await verifyPassword(input.password, user.passwordHash);
    if (!isValid) {
      throw new Error("Invalid username or password");
    }

    // アカウント停止チェック
    if (user.isSuspended) {
      throw new Error("Account is suspended");
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
    const sessionExpiryDays = Number.parseInt(process.env.SESSION_EXPIRY_DAYS || "30", 10);

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
