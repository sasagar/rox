/**
 * S3-Compatible Storage Adapter
 *
 * Saves files to S3-compatible storage such as AWS S3, Cloudflare R2, and MinIO.
 * Suitable for production environments.
 *
 * @module adapters/storage/S3StorageAdapter
 *
 * @remarks
 * - Uses AWS SDK v3
 * - Supports multi-server configurations
 * - Enables delivery via CDN
 */

import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { extname } from 'node:path';
import type { IFileStorage, FileMetadata } from '../../interfaces/IFileStorage.js';
import { generateId } from 'shared';

/**
 * S3 Storage Adapter
 *
 * Provides file storage to S3-compatible object storage.
 */
export class S3StorageAdapter implements IFileStorage {
  /**
   * S3StorageAdapter Constructor
   *
   * @param s3Client - Configured S3 client
   * @param bucketName - Destination bucket name
   * @param publicUrl - Public URL for file access (CDN URL, etc.)
   *
   * @example
   * ```typescript
   * const s3Client = new S3Client({
   *   region: 'us-east-1',
   *   credentials: {
   *     accessKeyId: process.env.S3_ACCESS_KEY,
   *     secretAccessKey: process.env.S3_SECRET_KEY,
   *   },
   * });
   *
   * const adapter = new S3StorageAdapter(
   *   s3Client,
   *   'my-bucket',
   *   'https://cdn.example.com'
   * );
   * ```
   */
  constructor(
    private s3Client: S3Client,
    private bucketName: string,
    private publicUrl: string
  ) {}

  /**
   * Upload File to S3
   *
   * @param file - Buffer of the file to upload
   * @param metadata - File metadata
   * @returns S3 key (storage path)
   *
   * @remarks
   * - Key format: `userId/generatedId.ext`
   * - Automatically sets Content-Type
   * - Sends Content-Length
   */
  async save(file: Buffer, metadata: FileMetadata): Promise<string> {
    const fileId = generateId();
    const ext = extname(metadata.name);
    const filename = `${fileId}${ext}`;

    // S3キー: userId/filename
    const key = `${metadata.userId}/${filename}`;

    // S3にアップロード
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: file,
        ContentType: metadata.type,
        ContentLength: metadata.size,
      })
    );

    return key;
  }

  /**
   * Delete File from S3
   *
   * @param filePath - S3 key of the file to delete
   */
  async delete(filePath: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: filePath,
      })
    );
  }

  /**
   * Get File Public URL
   *
   * @param filePath - S3 key of the file
   * @returns Public URL for accessing the file
   *
   * @example
   * ```typescript
   * const url = adapter.getUrl('user123/abc123.jpg');
   * // => 'https://cdn.example.com/user123/abc123.jpg'
   * ```
   *
   * @remarks
   * - Recommended to specify CDN URL for publicUrl
   * - Separate implementation required if signed URLs are needed
   */
  getUrl(filePath: string): string {
    // 公開URLを生成
    // 例: https://cdn.example.com/userId/filename.jpg
    return `${this.publicUrl}/${filePath}`;
  }
}
