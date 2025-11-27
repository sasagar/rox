export interface FileMetadata {
  name: string;
  type: string;
  size: number;
  userId: string;
}

/**
 * Emoji file metadata (not associated with any user)
 */
export interface EmojiFileMetadata {
  name: string;
  type: string;
  size: number;
}

export interface IFileStorage {
  /**
   * ファイルを保存
   * @param file ファイルのBuffer
   * @param metadata ファイルメタデータ
   * @returns 保存されたファイルのパス（相対パスまたはキー）
   */
  save(file: Buffer, metadata: FileMetadata): Promise<string>;

  /**
   * Save emoji file to dedicated emoji directory
   * Not associated with any user - instance-owned resource
   * @param file File buffer
   * @param metadata Emoji file metadata
   * @returns Relative path of the saved file
   */
  saveEmoji(file: Buffer, metadata: EmojiFileMetadata): Promise<string>;

  /**
   * ファイルを削除
   * @param filePath ファイルパス
   */
  delete(filePath: string): Promise<void>;

  /**
   * ファイルの公開URLを取得
   * @param filePath ファイルパス
   * @returns 公開アクセス可能なURL
   */
  getUrl(filePath: string): string;
}
