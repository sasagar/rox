import type { User } from "../../db/schema/pg.js";

/**
 * Pagination options for listing users
 */
export interface ListUsersOptions {
  /** Maximum number of users to return */
  limit?: number;
  /** Number of users to skip */
  offset?: number;
  /** Filter by local users only (host is null) */
  localOnly?: boolean;
  /** Filter by remote users only (host is not null) */
  remoteOnly?: boolean;
  /** Filter by admin status */
  isAdmin?: boolean;
  /** Filter by suspended status */
  isSuspended?: boolean;
}

/**
 * Options for searching users
 */
export interface SearchUsersOptions {
  /** Search query (matches username or displayName) */
  query: string;
  /** Maximum number of users to return */
  limit?: number;
  /** Number of users to skip */
  offset?: number;
  /** Filter by local users only (host is null) */
  localOnly?: boolean;
}

export interface IUserRepository {
  /**
   * ユーザーを作成
   */
  create(user: Omit<User, "createdAt" | "updatedAt">): Promise<User>;

  /**
   * IDでユーザーを取得
   */
  findById(id: string): Promise<User | null>;

  /**
   * Get all users with pagination and filters
   *
   * @param options - Pagination and filter options
   * @returns Array of users
   */
  findAll(options?: ListUsersOptions): Promise<User[]>;

  /**
   * ユーザー名でユーザーを取得
   * @param username ユーザー名
   * @param host ホスト名（nullの場合はローカルユーザー）
   */
  findByUsername(username: string, host?: string | null): Promise<User | null>;

  /**
   * メールアドレスでユーザーを取得
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * URIでユーザーを取得
   *
   * Remote ActivityPub actors are identified by their URI.
   * This method is used to resolve remote actors and check if they already exist in the database.
   *
   * @param uri - ActivityPub actor URI (e.g., "https://mastodon.social/users/alice")
   * @returns User record if found, null otherwise
   */
  findByUri(uri: string): Promise<User | null>;

  /**
   * ユーザー情報を更新
   */
  update(id: string, data: Partial<Omit<User, "id" | "createdAt">>): Promise<User>;

  /**
   * ユーザーを削除
   */
  delete(id: string): Promise<void>;

  /**
   * ユーザー数を取得
   * @param localOnly ローカルユーザーのみをカウントする場合はtrue
   */
  count(localOnly?: boolean): Promise<number>;

  /**
   * リモートユーザー数を取得
   */
  countRemote(): Promise<number>;

  /**
   * Count active local users within a time period
   *
   * Active users are those who have created at least one note within the period.
   * This is used for NodeInfo statistics.
   *
   * @param days - Number of days to look back (e.g., 30 for monthly, 180 for half-year)
   * @returns Number of active local users
   */
  countActiveLocal(days: number): Promise<number>;

  /**
   * Search users by username or displayName
   *
   * Performs a case-insensitive partial match on username and displayName.
   * For remote users, displayName may not be searchable depending on the server.
   *
   * @param options - Search options including query, limit, offset, and localOnly filter
   * @returns Array of matching users
   */
  search(options: SearchUsersOptions): Promise<User[]>;

  /**
   * Find remote users with fetch failures (410 Gone or other errors)
   *
   * Used by admin panel to list users that may need cleanup.
   *
   * @param options - Pagination options
   * @returns Array of users with goneDetectedAt set
   */
  findWithFetchErrors(options?: { limit?: number; offset?: number }): Promise<User[]>;

  /**
   * Count remote users with fetch failures
   *
   * @returns Number of users with goneDetectedAt set
   */
  countWithFetchErrors(): Promise<number>;

  /**
   * Record a fetch failure for a remote user
   *
   * Updates goneDetectedAt (if first failure), increments fetchFailureCount,
   * and records the error message.
   *
   * @param userId - User ID
   * @param errorMessage - Error message (e.g., "410 Gone", "404 Not Found")
   */
  recordFetchFailure(userId: string, errorMessage: string): Promise<void>;

  /**
   * Clear fetch failure status for a remote user
   *
   * Called when a remote user is successfully fetched again.
   *
   * @param userId - User ID
   */
  clearFetchFailure(userId: string): Promise<void>;

  /**
   * Find the first local admin user with a private key
   *
   * Used for signing outbound requests when an instance actor is needed.
   *
   * @returns First admin user found, or null if none exists
   */
  findFirstLocalAdmin(): Promise<User | null>;
}
