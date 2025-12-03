import type { Reaction } from "shared";

export interface IReactionRepository {
  /**
   * リアクションを作成
   */
  create(reaction: Omit<Reaction, "createdAt" | "updatedAt">): Promise<Reaction>;

  /**
   * IDでリアクションを取得
   */
  findById(id: string): Promise<Reaction | null>;

  /**
   * ユーザーとノートでリアクションを取得（最初の1つ）
   * @deprecated 複数リアクション対応のため、findByUserNoteAndReactionを使用してください
   */
  findByUserAndNote(userId: string, noteId: string): Promise<Reaction | null>;

  /**
   * ユーザー・ノート・リアクションの組み合わせでリアクションを取得
   */
  findByUserNoteAndReaction(
    userId: string,
    noteId: string,
    reaction: string,
  ): Promise<Reaction | null>;

  /**
   * ユーザーがノートに付けた全リアクションを取得
   */
  findByUserAndNoteAll(userId: string, noteId: string): Promise<Reaction[]>;

  /**
   * ノートの全リアクションを取得
   */
  findByNoteId(noteId: string, limit?: number): Promise<Reaction[]>;

  /**
   * ノートのリアクション数を集計
   * @returns { "👍": 5, "❤️": 3, ... }
   */
  countByNoteId(noteId: string): Promise<Record<string, number>>;

  /**
   * ノートのリアクション数とカスタム絵文字URLを集計
   * @returns { counts: { "👍": 5, ":custom:": 2 }, emojis: { ":custom:": "https://..." } }
   */
  countByNoteIdWithEmojis(noteId: string): Promise<{
    counts: Record<string, number>;
    emojis: Record<string, string>;
  }>;

  /**
   * 複数ノートのリアクション数を一括取得
   */
  countByNoteIds(noteIds: string[]): Promise<Map<string, Record<string, number>>>;

  /**
   * リアクションを削除（ユーザーとノートの組み合わせで最初の1つ）
   * @deprecated 複数リアクション対応のため、deleteByUserNoteAndReactionを使用してください
   */
  delete(userId: string, noteId: string): Promise<void>;

  /**
   * 特定のリアクションを削除
   */
  deleteByUserNoteAndReaction(userId: string, noteId: string, reaction: string): Promise<void>;

  /**
   * ノートの全リアクションを削除（ノート削除時）
   */
  deleteByNoteId(noteId: string): Promise<void>;
}
