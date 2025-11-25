import type { User } from '../../db/schema/pg.js';

export interface IUserRepository {
  /**
   * ユーザーを作成
   */
  create(user: Omit<User, 'createdAt' | 'updatedAt'>): Promise<User>;

  /**
   * IDでユーザーを取得
   */
  findById(id: string): Promise<User | null>;

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
  update(id: string, data: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User>;

  /**
   * ユーザーを削除
   */
  delete(id: string): Promise<void>;

  /**
   * ユーザー数を取得
   * @param localOnly ローカルユーザーのみをカウントする場合はtrue
   */
  count(localOnly?: boolean): Promise<number>;
}
