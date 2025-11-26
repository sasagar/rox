/**
 * File Management Service
 *
 * Handles file upload, storage, metadata management, and thumbnail generation.
 * Integrates with IFileStorage adapter for actual storage operations.
 *
 * @module services/FileService
 */

import { createHash } from 'node:crypto';
import { extname } from 'node:path';
import type { IDriveFileRepository } from '../interfaces/repositories/IDriveFileRepository.js';
import type { IFileStorage } from '../interfaces/IFileStorage.js';
import type { DriveFile } from '../../../shared/src/types/file.js';
import { generateId } from '../../../shared/src/utils/id.js';
import { getImageProcessor } from './ImageProcessor.js';

/**
 * File upload input data
 */
export interface FileUploadInput {
  /** File binary data */
  file: Buffer;
  /** Original filename */
  name: string;
  /** MIME type */
  type: string;
  /** User ID uploading the file */
  userId: string;
  /** Whether the file contains sensitive content */
  isSensitive?: boolean;
  /** Optional comment/description */
  comment?: string | null;
}

/**
 * File update input data
 */
export interface FileUpdateInput {
  /** Whether the file contains sensitive content */
  isSensitive?: boolean;
  /** Comment/description */
  comment?: string | null;
}

/**
 * File Service
 *
 * Provides business logic for file management operations including:
 * - File upload with validation
 * - MD5 hash calculation for deduplication
 * - Storage via adapter pattern
 * - Metadata persistence
 * - File deletion
 * - File metadata updates
 *
 * @remarks
 * - Maximum file size: 10MB (configurable via MAX_FILE_SIZE env var)
 * - Supported formats: images, videos, audio, documents
 * - Thumbnail generation: Phase 1.1 (future enhancement)
 */
export class FileService {
  private readonly maxFileSize: number;

  /**
   * FileService Constructor
   *
   * @param driveFileRepository - Drive file repository
   * @param storage - File storage adapter (Local or S3)
   */
  constructor(
    private readonly driveFileRepository: IDriveFileRepository,
    private readonly storage: IFileStorage,
  ) {
    // Default: 10MB, configurable via environment variable
    this.maxFileSize = Number.parseInt(process.env.MAX_FILE_SIZE || '10485760', 10);
  }

  /**
   * Upload a file
   *
   * Validates file size, calculates MD5 hash, stores the file via storage adapter,
   * and persists metadata to database.
   *
   * @param input - File upload parameters
   * @returns Created DriveFile record
   * @throws Error if file size exceeds limit
   * @throws Error if storage operation fails
   *
   * @example
   * ```typescript
   * const driveFile = await fileService.upload({
   *   file: buffer,
   *   name: 'photo.jpg',
   *   type: 'image/jpeg',
   *   userId: user.id,
   *   isSensitive: false,
   * });
   * ```
   *
   * @remarks
   * - File size validation occurs before storage
   * - MD5 hash enables future deduplication
   * - Storage key format depends on adapter (local path or S3 key)
   */
  async upload(input: FileUploadInput): Promise<DriveFile> {
    const { file, name, type, userId, isSensitive = false, comment = null } = input;

    // ファイルサイズのバリデーション
    if (file.byteLength > this.maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`,
      );
    }

    // MD5ハッシュ計算（将来の重複排除用）
    const md5 = createHash('md5').update(file).digest('hex');

    const imageProcessor = getImageProcessor();
    let fileToSave = file;
    let fileType = type;
    let fileName = name;
    let thumbnailUrl: string | null = null;
    let blurhash: string | null = null;

    // Process images: convert to WebP and generate thumbnail
    if (imageProcessor.isImage(type)) {
      try {
        const processed = await imageProcessor.process(file, type);

        // Use WebP version as main file
        fileToSave = processed.webp;
        fileType = processed.webpType;
        fileName = this.replaceExtension(name, '.webp');
        blurhash = processed.blurhash;

        // Save thumbnail
        const thumbnailName = this.replaceExtension(name, '_thumb.webp');
        const thumbnailKey = await this.storage.save(processed.thumbnail, {
          name: thumbnailName,
          type: processed.thumbnailType,
          size: processed.thumbnail.byteLength,
          userId,
        });
        thumbnailUrl = this.storage.getUrl(thumbnailKey);

        console.log(`🖼️  Image processed: ${name} → WebP (${Math.round(processed.webp.byteLength / 1024)}KB)`);
      } catch (error) {
        // Fall back to original file if processing fails
        console.warn(`⚠️  Image processing failed for ${name}, using original:`, error);
      }
    }

    // ストレージに保存
    const storageKey = await this.storage.save(fileToSave, {
      name: fileName,
      type: fileType,
      size: fileToSave.byteLength,
      userId,
    });

    // 公開URLを取得
    const url = this.storage.getUrl(storageKey);

    // データベースに記録
    const driveFile = await this.driveFileRepository.create({
      id: generateId(),
      userId,
      name: fileName,
      type: fileType,
      size: fileToSave.byteLength,
      md5,
      url,
      thumbnailUrl,
      blurhash,
      comment,
      isSensitive,
      storageKey,
    });

    return driveFile;
  }

  /**
   * Replace file extension
   *
   * @param filename - Original filename
   * @param newExt - New extension (including dot)
   * @returns Filename with new extension
   */
  private replaceExtension(filename: string, newExt: string): string {
    const ext = extname(filename);
    if (ext) {
      return filename.slice(0, -ext.length) + newExt;
    }
    return filename + newExt;
  }

  /**
   * Get a file by ID
   *
   * @param fileId - File ID
   * @param userId - User ID (for ownership verification)
   * @returns DriveFile record or null if not found
   *
   * @example
   * ```typescript
   * const file = await fileService.findById('file123', 'user456');
   * if (!file) {
   *   throw new Error('File not found or access denied');
   * }
   * ```
   */
  async findById(fileId: string, userId: string): Promise<DriveFile | null> {
    const file = await this.driveFileRepository.findById(fileId);

    // 所有者確認
    if (file && file.userId !== userId) {
      return null;
    }

    return file;
  }

  /**
   * List user's files
   *
   * @param userId - User ID
   * @param options - Pagination options
   * @returns List of DriveFile records
   *
   * @example
   * ```typescript
   * const files = await fileService.listFiles('user456', {
   *   limit: 20,
   *   sinceId: 'file123',
   * });
   * ```
   */
  async listFiles(
    userId: string,
    options: { limit?: number; sinceId?: string; untilId?: string } = {},
  ): Promise<DriveFile[]> {
    return await this.driveFileRepository.findByUserId(userId, options);
  }

  /**
   * Update file metadata
   *
   * Only allows updating isSensitive flag and comment.
   * File content and storage location cannot be changed.
   *
   * @param fileId - File ID
   * @param userId - User ID (for ownership verification)
   * @param input - Update parameters
   * @returns Updated DriveFile record
   * @throws Error if file not found or access denied
   *
   * @example
   * ```typescript
   * const updated = await fileService.update('file123', 'user456', {
   *   isSensitive: true,
   *   comment: 'Contains sensitive information',
   * });
   * ```
   */
  async update(
    fileId: string,
    userId: string,
    input: FileUpdateInput,
  ): Promise<DriveFile> {
    const file = await this.findById(fileId, userId);

    if (!file) {
      throw new Error('File not found or access denied');
    }

    const updateData: Partial<DriveFile> = {};

    if (input.isSensitive !== undefined) {
      updateData.isSensitive = input.isSensitive;
    }

    if (input.comment !== undefined) {
      updateData.comment = input.comment;
    }

    return await this.driveFileRepository.update(fileId, updateData);
  }

  /**
   * Delete a file
   *
   * Removes file from both storage and database.
   * Ensures user owns the file before deletion.
   *
   * @param fileId - File ID
   * @param userId - User ID (for ownership verification)
   * @throws Error if file not found or access denied
   * @throws Error if storage deletion fails
   *
   * @example
   * ```typescript
   * await fileService.delete('file123', 'user456');
   * ```
   *
   * @remarks
   * - Storage deletion happens first
   * - Database record deleted only if storage deletion succeeds
   * - If storage deletion fails, database record remains (manual cleanup may be needed)
   */
  async delete(fileId: string, userId: string): Promise<void> {
    const file = await this.findById(fileId, userId);

    if (!file) {
      throw new Error('File not found or access denied');
    }

    // ストレージから削除
    await this.storage.delete(file.storageKey);

    // データベースから削除
    await this.driveFileRepository.delete(fileId);
  }

  /**
   * Calculate total storage usage for a user
   *
   * @param userId - User ID
   * @returns Total bytes used
   *
   * @example
   * ```typescript
   * const usageBytes = await fileService.getStorageUsage('user456');
   * const usageMB = usageBytes / (1024 * 1024);
   * ```
   */
  async getStorageUsage(userId: string): Promise<number> {
    const files = await this.driveFileRepository.findByUserId(userId);
    return files.reduce((total, file) => total + file.size, 0);
  }
}
