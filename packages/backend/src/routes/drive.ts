/**
 * Drive API Routes
 *
 * Provides file management endpoints for the Misskey-compatible drive system.
 * Handles file uploads, retrieval, updates, and deletion.
 *
 * @module routes/drive
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { requireAuth } from '../middleware/auth.js';
import { FileService } from '../services/FileService.js';

const drive = new Hono();

/**
 * POST /api/drive/files/create
 *
 * Upload a new file to the drive.
 *
 * @remarks
 * - Requires authentication
 * - Accepts multipart/form-data
 * - Maximum file size: 10MB (configurable)
 */
drive.post('/files/create', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const driveFileRepository = c.get('driveFileRepository');
  const fileStorage = c.get('fileStorage');

  const fileService = new FileService(driveFileRepository, fileStorage);

  // multipart/form-data からファイルを取得
  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }

  // ファイルをBufferに変換
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // オプショナルパラメータ
  const isSensitive = body.isSensitive === 'true';
  const comment = typeof body.comment === 'string' ? body.comment : null;

  try {
    const driveFile = await fileService.upload({
      file: buffer,
      name: file.name,
      type: file.type,
      userId: user.id,
      isSensitive,
      comment,
    });

    return c.json(driveFile, 201);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    throw error;
  }
});

/**
 * GET /api/drive/files
 *
 * List user's files with pagination.
 *
 * @remarks
 * - Requires authentication
 * - Returns files owned by the authenticated user
 * - Supports pagination via sinceId/untilId
 */
drive.get('/files', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const driveFileRepository = c.get('driveFileRepository');
  const fileStorage = c.get('fileStorage');

  const fileService = new FileService(driveFileRepository, fileStorage);

  // クエリパラメータ
  const limit = Number.parseInt(c.req.query('limit') || '20', 10);
  const sinceId = c.req.query('sinceId');
  const untilId = c.req.query('untilId');

  const files = await fileService.listFiles(user.id, {
    limit,
    sinceId,
    untilId,
  });

  return c.json(files);
});

/**
 * GET /api/drive/files/show
 *
 * Get file information by ID.
 *
 * @remarks
 * - Requires authentication
 * - Only file owner can access
 */
drive.get('/files/show', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const driveFileRepository = c.get('driveFileRepository');
  const fileStorage = c.get('fileStorage');

  const fileService = new FileService(driveFileRepository, fileStorage);

  const fileId = c.req.query('fileId');

  if (!fileId) {
    return c.json({ error: 'fileId is required' }, 400);
  }

  const file = await fileService.findById(fileId, user.id);

  if (!file) {
    return c.json({ error: 'File not found' }, 404);
  }

  return c.json(file);
});

/**
 * POST /api/drive/files/update
 *
 * Update file metadata (isSensitive, comment).
 *
 * @remarks
 * - Requires authentication
 * - Only file owner can update
 * - Cannot change file content or storage location
 */
drive.post('/files/update', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const driveFileRepository = c.get('driveFileRepository');
  const fileStorage = c.get('fileStorage');

  const fileService = new FileService(driveFileRepository, fileStorage);

  const body = await c.req.json();
  const { fileId, isSensitive, comment } = body;

  if (!fileId) {
    return c.json({ error: 'fileId is required' }, 400);
  }

  try {
    const updatedFile = await fileService.update(fileId, user.id, {
      isSensitive,
      comment,
    });

    return c.json(updatedFile);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

/**
 * POST /api/drive/files/delete
 *
 * Delete a file from both storage and database.
 *
 * @remarks
 * - Requires authentication
 * - Only file owner can delete
 * - Removes file from storage adapter and database
 */
drive.post('/files/delete', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const driveFileRepository = c.get('driveFileRepository');
  const fileStorage = c.get('fileStorage');

  const fileService = new FileService(driveFileRepository, fileStorage);

  const body = await c.req.json();
  const { fileId } = body;

  if (!fileId) {
    return c.json({ error: 'fileId is required' }, 400);
  }

  try {
    await fileService.delete(fileId, user.id);

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 404);
    }
    throw error;
  }
});

/**
 * GET /api/drive/usage
 *
 * Get user's total storage usage.
 *
 * @remarks
 * - Requires authentication
 * - Returns total bytes used by the authenticated user
 */
drive.get('/usage', requireAuth(), async (c: Context) => {
  const user = c.get('user')!;
  const driveFileRepository = c.get('driveFileRepository');
  const fileStorage = c.get('fileStorage');

  const fileService = new FileService(driveFileRepository, fileStorage);

  const usageBytes = await fileService.getStorageUsage(user.id);

  return c.json({
    usage: usageBytes,
    usageMB: Math.round((usageBytes / (1024 * 1024)) * 100) / 100,
  });
});

export default drive;
