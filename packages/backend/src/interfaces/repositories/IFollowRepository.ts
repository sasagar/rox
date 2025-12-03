import type { Follow } from "shared";

export interface IFollowRepository {
  /**
   * フォロー関係を作成
   */
  create(follow: Omit<Follow, "createdAt" | "updatedAt">): Promise<Follow>;

  /**
   * IDでフォロー関係を取得
   */
  findById(id: string): Promise<Follow | null>;

  /**
   * フォロー関係が存在するか確認
   */
  exists(followerId: string, followeeId: string): Promise<boolean>;

  /**
   * フォロワー一覧を取得（followeeIdがフォローされているユーザー）
   */
  findByFolloweeId(followeeId: string, limit?: number): Promise<Follow[]>;

  /**
   * フォロイング一覧を取得（followerIdがフォローしているユーザー）
   */
  findByFollowerId(followerId: string, limit?: number): Promise<Follow[]>;

  /**
   * フォロワー数を取得
   */
  countFollowers(userId: string): Promise<number>;

  /**
   * フォロイング数を取得
   */
  countFollowing(userId: string): Promise<number>;

  /**
   * フォロー関係を削除
   */
  delete(followerId: string, followeeId: string): Promise<void>;

  /**
   * ユーザーに関連する全フォロー関係を削除（ユーザー削除時）
   */
  deleteByUserId(userId: string): Promise<void>;
}
