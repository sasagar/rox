import type { DriveFile } from "shared";

export interface IDriveFileRepository {
  /**
   * ファイルを作成
   */
  create(file: Omit<DriveFile, "createdAt" | "updatedAt">): Promise<DriveFile>;

  /**
   * IDでファイルを取得
   */
  findById(id: string): Promise<DriveFile | null>;

  /**
   * 全ファイルを取得（管理者用）
   */
  findAll(options?: { limit?: number; offset?: number }): Promise<DriveFile[]>;

  /**
   * MD5ハッシュでファイルを取得（重複チェック用）
   */
  findByMd5(md5: string, userId: string): Promise<DriveFile | null>;

  /**
   * ユーザーのファイル一覧を取得
   */
  findByUserId(
    userId: string,
    options?: {
      limit?: number;
      sinceId?: string;
      untilId?: string;
      folderId?: string | null;
    },
  ): Promise<DriveFile[]>;

  /**
   * ファイルを別のフォルダに移動
   */
  moveToFolder(id: string, folderId: string | null): Promise<DriveFile>;

  /**
   * 複数のIDでファイルを取得
   */
  findByIds(ids: string[]): Promise<DriveFile[]>;

  /**
   * ファイル情報を更新
   */
  update(
    id: string,
    data: Partial<Omit<DriveFile, "id" | "userId" | "createdAt">>,
  ): Promise<DriveFile>;

  /**
   * ファイルを削除
   */
  delete(id: string): Promise<void>;

  /**
   * ユーザーの使用容量を取得
   */
  getTotalSize(userId: string): Promise<number>;
}
