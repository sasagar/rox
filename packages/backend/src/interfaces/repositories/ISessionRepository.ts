import type { Session } from "shared";

export interface ISessionRepository {
  /**
   * セッションを作成
   */
  create(session: Omit<Session, "createdAt" | "updatedAt">): Promise<Session>;

  /**
   * IDでセッションを取得
   */
  findById(id: string): Promise<Session | null>;

  /**
   * トークンでセッションを取得
   */
  findByToken(token: string): Promise<Session | null>;

  /**
   * ユーザーの全セッションを取得
   */
  findByUserId(userId: string): Promise<Session[]>;

  /**
   * セッションの有効期限を更新
   */
  updateExpiresAt(id: string, expiresAt: Date): Promise<Session>;

  /**
   * セッションを削除
   */
  delete(id: string): Promise<void>;

  /**
   * トークンでセッションを削除
   */
  deleteByToken(token: string): Promise<void>;

  /**
   * ユーザーの全セッションを削除
   */
  deleteByUserId(userId: string): Promise<void>;

  /**
   * 期限切れセッションを削除
   */
  deleteExpired(): Promise<number>;

  /**
   * Count active sessions (logins) within a time period
   * Used for Mastodon API instance activity statistics
   *
   * @param startDate - Start of the period (inclusive)
   * @param endDate - End of the period (exclusive)
   * @returns Number of unique users with active sessions in the period
   */
  countActiveInPeriod?(startDate: Date, endDate: Date): Promise<number>;
}
