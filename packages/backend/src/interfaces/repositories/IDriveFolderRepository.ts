import type { DriveFolder } from "shared";

export interface IDriveFolderRepository {
  /**
   * フォルダを作成
   */
  create(folder: Omit<DriveFolder, "createdAt" | "updatedAt">): Promise<DriveFolder>;

  /**
   * IDでフォルダを取得
   */
  findById(id: string): Promise<DriveFolder | null>;

  /**
   * ユーザーのフォルダ一覧を取得
   */
  findByUserId(
    userId: string,
    options?: {
      parentId?: string | null;
      limit?: number;
    },
  ): Promise<DriveFolder[]>;

  /**
   * フォルダ情報を更新（名前変更など）
   */
  update(
    id: string,
    data: Partial<Pick<DriveFolder, "name" | "parentId">>,
  ): Promise<DriveFolder>;

  /**
   * フォルダを削除
   */
  delete(id: string): Promise<void>;

  /**
   * 親フォルダまでのパスを取得
   */
  getPath(id: string): Promise<DriveFolder[]>;

  /**
   * 子フォルダの数を取得
   */
  countChildren(id: string): Promise<number>;
}
