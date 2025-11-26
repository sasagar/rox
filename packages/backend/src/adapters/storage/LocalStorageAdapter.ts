import { mkdir, unlink } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { existsSync } from 'node:fs';
import type { IFileStorage, FileMetadata } from '../../interfaces/IFileStorage.js';
import { generateId } from 'shared';

/**
 * Local Filesystem Storage Adapter
 *
 * Saves files to the local filesystem.
 * Suitable for development environments and single-server configurations.
 *
 * @remarks
 * - Files are saved in separate directories per user
 * - Filenames use auto-generated IDs
 * - Uses Bun's native `Bun.write` (fast)
 * - S3StorageAdapter recommended for production environments
 */
export class LocalStorageAdapter implements IFileStorage {
  /**
   * LocalStorageAdapter Constructor
   *
   * @param basePath - Base path for file storage
   * @param baseUrl - Base URL for file access
   */
  constructor(
    private basePath: string,
    private baseUrl: string
  ) {}

  /**
   * Save File
   *
   * Saves files at high speed using Bun's native `Bun.write` API.
   *
   * @param file - Buffer of the file to save
   * @param metadata - File metadata
   * @returns Relative path of the saved file
   *
   * @remarks
   * - `Bun.write` is faster than Node.js's `fs.writeFile`
   * - Automatically creates directory if it doesn't exist
   */
  async save(file: Buffer, metadata: FileMetadata): Promise<string> {
    const fileId = generateId();
    const ext = extname(metadata.name);
    const filename = `${fileId}${ext}`;

    // ユーザーごとのディレクトリに保存
    const relativePath = join(metadata.userId, filename);
    const fullPath = join(this.basePath, relativePath);

    // ディレクトリが存在しない場合は作成
    const dir = dirname(fullPath);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    // Bunのネイティブ関数でファイルを保存（高速）
    await Bun.write(fullPath, file);

    return relativePath;
  }

  /**
   * Delete File
   *
   * @param filePath - Relative path of the file to delete
   */
  async delete(filePath: string): Promise<void> {
    const fullPath = join(this.basePath, filePath);

    try {
      await unlink(fullPath);
    } catch (error) {
      // ファイルが存在しない場合は無視
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Get File Public URL
   *
   * @param filePath - Relative path of the file
   * @returns Public URL for accessing the file
   *
   * @example
   * ```typescript
   * const url = adapter.getUrl('user123/abc123.jpg');
   * // => 'http://localhost:3000/files/user123/abc123.jpg'
   * ```
   */
  getUrl(filePath: string): string {
    // ファイルパスをURLに変換
    // 例: user123/abc123.jpg -> http://localhost:3000/files/user123/abc123.jpg
    return `${this.baseUrl}/files/${filePath}`;
  }
}
