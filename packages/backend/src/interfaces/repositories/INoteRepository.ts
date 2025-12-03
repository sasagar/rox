import type { Note } from "shared";

export interface TimelineOptions {
  limit?: number;
  sinceId?: string;
  untilId?: string;
  userIds?: string[];
}

export interface INoteRepository {
  /**
   * ノートを作成
   */
  create(note: Omit<Note, "createdAt" | "updatedAt">): Promise<Note>;

  /**
   * IDでノートを取得
   */
  findById(id: string): Promise<Note | null>;

  /**
   * URIでノートを取得（リモートノート用）
   */
  findByUri(uri: string): Promise<Note | null>;

  /**
   * ローカルタイムラインを取得
   * ローカルユーザーの公開投稿のみ
   */
  getLocalTimeline(options: TimelineOptions): Promise<Note[]>;

  /**
   * ホームタイムラインを取得
   * 指定したユーザーIDリストの投稿を取得
   */
  getTimeline(options: TimelineOptions & { userIds: string[] }): Promise<Note[]>;

  /**
   * ソーシャルタイムラインを取得
   * ローカルの公開投稿 + フォロー中のリモートユーザーの投稿
   */
  getSocialTimeline(options: TimelineOptions & { userIds?: string[] }): Promise<Note[]>;

  /**
   * グローバルタイムラインを取得
   * ローカル + リモートユーザーのすべての公開投稿
   */
  getGlobalTimeline(options: TimelineOptions): Promise<Note[]>;

  /**
   * ユーザーの投稿を取得
   */
  findByUserId(userId: string, options: TimelineOptions): Promise<Note[]>;

  /**
   * リプライを取得
   */
  findReplies(noteId: string, options: TimelineOptions): Promise<Note[]>;

  /**
   * Renoteを取得
   */
  findRenotes(noteId: string, options: TimelineOptions): Promise<Note[]>;

  /**
   * ノートを更新
   */
  update(id: string, data: Partial<Omit<Note, "id" | "createdAt">>): Promise<Note>;

  /**
   * ノートを削除（ハードデリート）
   */
  delete(id: string): Promise<void>;

  /**
   * ノートをソフトデリート（モデレーション用）
   * @param id ノートID
   * @param deletedById 削除を実行したモデレーターのID
   * @param reason 削除理由
   */
  softDelete(id: string, deletedById: string, reason?: string): Promise<Note | null>;

  /**
   * ソフトデリートされたノートを復元
   * @param id ノートID
   */
  restore(id: string): Promise<Note | null>;

  /**
   * ソフトデリートされたノートを取得（モデレーター用）
   */
  findDeletedNotes(options?: {
    limit?: number;
    offset?: number;
    deletedById?: string;
  }): Promise<Note[]>;

  /**
   * ノート数を取得
   * @param localOnly ローカルノートのみをカウントする場合はtrue
   */
  count(localOnly?: boolean): Promise<number>;

  /**
   * 特定ユーザーのノート数を取得
   * @param userId ユーザーID
   */
  countByUserId(userId: string): Promise<number>;
}
