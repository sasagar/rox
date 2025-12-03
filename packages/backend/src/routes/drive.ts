/**
 * Drive API Routes
 *
 * Provides file management endpoints for the Misskey-compatible drive system.
 * Handles file uploads, retrieval, updates, and deletion.
 *
 * @module routes/drive
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { generateId } from "shared";
import { requireAuth } from "../middleware/auth.js";
import { userRateLimit, RateLimitPresets } from "../middleware/rateLimit.js";
import { FileService } from "../services/FileService.js";

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
drive.post(
  "/files/create",
  requireAuth(),
  userRateLimit(RateLimitPresets.fileUpload),
  async (c: Context) => {
    const user = c.get("user")!;
    const driveFileRepository = c.get("driveFileRepository");
    const fileStorage = c.get("fileStorage");
    const roleService = c.get("roleService");

    const fileService = new FileService(driveFileRepository, fileStorage, roleService);

    // multipart/form-data からファイルを取得
    const body = await c.req.parseBody();
    const file = body.file as File;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    // ファイルをBufferに変換
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // オプショナルパラメータ
    const isSensitive = body.isSensitive === "true";
    const comment = typeof body.comment === "string" ? body.comment : null;
    const folderId = typeof body.folderId === "string" ? body.folderId : null;

    // Validate folderId if provided
    if (folderId) {
      const driveFolderRepository = c.get("driveFolderRepository");
      const folder = await driveFolderRepository.findById(folderId);
      if (!folder || folder.userId !== user.id) {
        return c.json({ error: "Folder not found" }, 404);
      }
    }

    try {
      const driveFile = await fileService.upload({
        file: buffer,
        name: file.name,
        type: file.type,
        userId: user.id,
        isSensitive,
        comment,
        folderId,
      });

      return c.json(driveFile, 201);
    } catch (error) {
      if (error instanceof Error) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }
  },
);

/**
 * GET /api/drive/files
 *
 * List user's files with pagination.
 *
 * @remarks
 * - Requires authentication
 * - Returns files owned by the authenticated user
 * - Supports pagination via sinceId/untilId
 * - Supports filtering by folderId (null for root, undefined for all)
 */
drive.get("/files", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const driveFileRepository = c.get("driveFileRepository");
  const fileStorage = c.get("fileStorage");

  const fileService = new FileService(driveFileRepository, fileStorage);

  // クエリパラメータ
  const limit = Number.parseInt(c.req.query("limit") || "20", 10);
  const sinceId = c.req.query("sinceId");
  const untilId = c.req.query("untilId");
  const folderIdParam = c.req.query("folderId");

  // folderId can be:
  // - undefined: list all files (no filter)
  // - "null" or empty string: list root files only
  // - string: list files in that folder
  let folderId: string | null | undefined;
  if (folderIdParam === "null" || folderIdParam === "") {
    folderId = null;
  } else if (folderIdParam) {
    folderId = folderIdParam;
  }

  const files = await fileService.listFiles(user.id, {
    limit,
    sinceId,
    untilId,
    folderId,
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
drive.get("/files/show", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const driveFileRepository = c.get("driveFileRepository");
  const fileStorage = c.get("fileStorage");

  const fileService = new FileService(driveFileRepository, fileStorage);

  const fileId = c.req.query("fileId");

  if (!fileId) {
    return c.json({ error: "fileId is required" }, 400);
  }

  const file = await fileService.findById(fileId, user.id);

  if (!file) {
    return c.json({ error: "File not found" }, 404);
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
drive.post(
  "/files/update",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const driveFileRepository = c.get("driveFileRepository");
    const fileStorage = c.get("fileStorage");

    const fileService = new FileService(driveFileRepository, fileStorage);

    const body = await c.req.json();
    const { fileId, isSensitive, comment } = body;

    if (!fileId) {
      return c.json({ error: "fileId is required" }, 400);
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
  },
);

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
drive.post(
  "/files/delete",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const driveFileRepository = c.get("driveFileRepository");
    const fileStorage = c.get("fileStorage");

    const fileService = new FileService(driveFileRepository, fileStorage);

    const body = await c.req.json();
    const { fileId } = body;

    if (!fileId) {
      return c.json({ error: "fileId is required" }, 400);
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
  },
);

/**
 * GET /api/drive/usage
 *
 * Get user's storage usage with quota information.
 *
 * @remarks
 * - Requires authentication
 * - Returns total bytes used, quota, and file count
 */
drive.get("/usage", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const driveFileRepository = c.get("driveFileRepository");
  const fileStorage = c.get("fileStorage");
  const roleService = c.get("roleService");

  const fileService = new FileService(driveFileRepository, fileStorage, roleService);

  const usageBytes = await fileService.getStorageUsage(user.id);
  const quotaMb = await roleService.getDriveCapacity(user.id);
  const files = await driveFileRepository.findByUserId(user.id);

  // Count files by source
  const userFiles = files.filter((f: any) => f.source === "user" || !f.source);
  const systemFiles = files.filter((f: any) => f.source === "system");

  return c.json({
    usage: usageBytes,
    usageMB: Math.round((usageBytes / (1024 * 1024)) * 100) / 100,
    quotaMB: quotaMb,
    quotaBytes: quotaMb === -1 ? -1 : quotaMb * 1024 * 1024,
    isUnlimited: quotaMb === -1,
    usagePercent: quotaMb === -1 ? 0 : Math.round((usageBytes / (quotaMb * 1024 * 1024)) * 100),
    fileCount: {
      total: files.length,
      user: userFiles.length,
      system: systemFiles.length,
    },
  });
});

/**
 * GET /api/drive/stats
 *
 * Get detailed storage statistics for the user.
 *
 * @remarks
 * - Requires authentication
 * - Returns file type breakdown and size distribution
 */
drive.get("/stats", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const driveFileRepository = c.get("driveFileRepository");

  const files = await driveFileRepository.findByUserId(user.id);

  // Group by type
  const byType: Record<string, { count: number; size: number }> = {};
  for (const file of files) {
    const category = getFileCategory(file.type);
    if (!byType[category]) {
      byType[category] = { count: 0, size: 0 };
    }
    byType[category].count++;
    byType[category].size += file.size;
  }

  // Group by source
  const bySource: Record<string, { count: number; size: number }> = {
    user: { count: 0, size: 0 },
    system: { count: 0, size: 0 },
  };
  for (const file of files) {
    const source = (file as any).source || "user";
    if (!bySource[source]) {
      bySource[source] = { count: 0, size: 0 };
    }
    bySource[source].count++;
    bySource[source].size += file.size;
  }

  return c.json({
    byType,
    bySource,
    totalFiles: files.length,
    totalSize: files.reduce((sum, f) => sum + f.size, 0),
  });
});

/**
 * Categorize file by MIME type
 */
function getFileCategory(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("text/")) return "text";
  if (mimeType.includes("pdf")) return "document";
  return "other";
}

// ===== Folder Endpoints =====

/**
 * POST /api/drive/folders/create
 *
 * Create a new folder.
 *
 * @remarks
 * - Requires authentication
 * - Optional parentId for nested folders
 */
drive.post(
  "/folders/create",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const driveFolderRepository = c.get("driveFolderRepository");

    const body = await c.req.json();
    const { name, parentId } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return c.json({ error: "Folder name is required" }, 400);
    }

    if (name.length > 200) {
      return c.json({ error: "Folder name is too long (max 200 characters)" }, 400);
    }

    // Validate parentId if provided
    if (parentId) {
      const parentFolder = await driveFolderRepository.findById(parentId);
      if (!parentFolder) {
        return c.json({ error: "Parent folder not found" }, 404);
      }
      if (parentFolder.userId !== user.id) {
        return c.json({ error: "Parent folder not found" }, 404);
      }
    }

    const folder = await driveFolderRepository.create({
      id: generateId(),
      userId: user.id,
      parentId: parentId || null,
      name: name.trim(),
    });

    return c.json(folder, 201);
  },
);

/**
 * GET /api/drive/folders
 *
 * List user's folders.
 *
 * @remarks
 * - Requires authentication
 * - Optional parentId to list subfolders (null for root)
 */
drive.get("/folders", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const driveFolderRepository = c.get("driveFolderRepository");

  const parentId = c.req.query("parentId");
  const limit = Number.parseInt(c.req.query("limit") || "100", 10);

  // parentId can be:
  // - undefined: list all folders
  // - "null" or empty: list root folders
  // - string: list subfolders of that folder
  let parentIdFilter: string | null | undefined;
  if (parentId === "null" || parentId === "") {
    parentIdFilter = null;
  } else if (parentId) {
    parentIdFilter = parentId;
  }

  const folders = await driveFolderRepository.findByUserId(user.id, {
    parentId: parentIdFilter,
    limit: Math.min(limit, 100),
  });

  return c.json(folders);
});

/**
 * GET /api/drive/folders/show
 *
 * Get folder information by ID.
 *
 * @remarks
 * - Requires authentication
 * - Only folder owner can access
 */
drive.get("/folders/show", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const driveFolderRepository = c.get("driveFolderRepository");
  const driveFileRepository = c.get("driveFileRepository");

  const folderId = c.req.query("folderId");

  if (!folderId) {
    return c.json({ error: "folderId is required" }, 400);
  }

  const folder = await driveFolderRepository.findById(folderId);

  if (!folder) {
    return c.json({ error: "Folder not found" }, 404);
  }

  if (folder.userId !== user.id) {
    return c.json({ error: "Folder not found" }, 404);
  }

  // Get child folders and files count
  const childFolderCount = await driveFolderRepository.countChildren(folderId);
  const files = await driveFileRepository.findByUserId(user.id, { folderId, limit: 1000 });

  return c.json({
    ...folder,
    childFolderCount,
    fileCount: files.length,
  });
});

/**
 * POST /api/drive/folders/update
 *
 * Update folder metadata (name, parentId).
 *
 * @remarks
 * - Requires authentication
 * - Only folder owner can update
 * - Cannot move folder into its own descendants
 */
drive.post(
  "/folders/update",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const driveFolderRepository = c.get("driveFolderRepository");

    const body = await c.req.json();
    const { folderId, name, parentId } = body;

    if (!folderId) {
      return c.json({ error: "folderId is required" }, 400);
    }

    const folder = await driveFolderRepository.findById(folderId);

    if (!folder) {
      return c.json({ error: "Folder not found" }, 404);
    }

    if (folder.userId !== user.id) {
      return c.json({ error: "Folder not found" }, 404);
    }

    const updates: { name?: string; parentId?: string | null } = {};

    if (name !== undefined) {
      if (typeof name !== "string" || name.trim().length === 0) {
        return c.json({ error: "Folder name cannot be empty" }, 400);
      }
      if (name.length > 200) {
        return c.json({ error: "Folder name is too long (max 200 characters)" }, 400);
      }
      updates.name = name.trim();
    }

    if (parentId !== undefined) {
      // Check for circular reference - cannot move folder into itself or its descendants
      if (parentId === folderId) {
        return c.json({ error: "Cannot move folder into itself" }, 400);
      }

      if (parentId !== null) {
        const parentFolder = await driveFolderRepository.findById(parentId);
        if (!parentFolder) {
          return c.json({ error: "Parent folder not found" }, 404);
        }
        if (parentFolder.userId !== user.id) {
          return c.json({ error: "Parent folder not found" }, 404);
        }

        // Check if target parent is a descendant of current folder
        const parentPath = await driveFolderRepository.getPath(parentId);
        if (parentPath.some((f) => f.id === folderId)) {
          return c.json({ error: "Cannot move folder into its descendant" }, 400);
        }
      }

      updates.parentId = parentId;
    }

    if (Object.keys(updates).length === 0) {
      return c.json(folder);
    }

    const updatedFolder = await driveFolderRepository.update(folderId, updates);

    return c.json(updatedFolder);
  },
);

/**
 * POST /api/drive/folders/delete
 *
 * Delete a folder.
 *
 * @remarks
 * - Requires authentication
 * - Only folder owner can delete
 * - Files in the folder will have their folderId set to null (moved to root)
 * - Child folders will also have their parentId set to null
 */
drive.post(
  "/folders/delete",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const driveFolderRepository = c.get("driveFolderRepository");

    const body = await c.req.json();
    const { folderId } = body;

    if (!folderId) {
      return c.json({ error: "folderId is required" }, 400);
    }

    const folder = await driveFolderRepository.findById(folderId);

    if (!folder) {
      return c.json({ error: "Folder not found" }, 404);
    }

    if (folder.userId !== user.id) {
      return c.json({ error: "Folder not found" }, 404);
    }

    await driveFolderRepository.delete(folderId);

    return c.json({ success: true });
  },
);

/**
 * GET /api/drive/folders/path
 *
 * Get the folder path (breadcrumb) from root to the specified folder.
 *
 * @remarks
 * - Requires authentication
 * - Returns array of folders from root to target
 */
drive.get("/folders/path", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const driveFolderRepository = c.get("driveFolderRepository");

  const folderId = c.req.query("folderId");

  if (!folderId) {
    return c.json({ error: "folderId is required" }, 400);
  }

  const folder = await driveFolderRepository.findById(folderId);

  if (!folder) {
    return c.json({ error: "Folder not found" }, 404);
  }

  if (folder.userId !== user.id) {
    return c.json({ error: "Folder not found" }, 404);
  }

  const path = await driveFolderRepository.getPath(folderId);

  return c.json(path);
});

/**
 * POST /api/drive/files/move
 *
 * Move a file to a different folder.
 *
 * @remarks
 * - Requires authentication
 * - Only file owner can move
 * - Set folderId to null to move to root
 */
drive.post(
  "/files/move",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const driveFileRepository = c.get("driveFileRepository");
    const driveFolderRepository = c.get("driveFolderRepository");

    const body = await c.req.json();
    const { fileId, folderId } = body;

    if (!fileId) {
      return c.json({ error: "fileId is required" }, 400);
    }

    const file = await driveFileRepository.findById(fileId);

    if (!file) {
      return c.json({ error: "File not found" }, 404);
    }

    if (file.userId !== user.id) {
      return c.json({ error: "File not found" }, 404);
    }

    // Validate destination folder if provided
    if (folderId !== null && folderId !== undefined) {
      const folder = await driveFolderRepository.findById(folderId);
      if (!folder) {
        return c.json({ error: "Destination folder not found" }, 404);
      }
      if (folder.userId !== user.id) {
        return c.json({ error: "Destination folder not found" }, 404);
      }
    }

    const updatedFile = await driveFileRepository.moveToFolder(fileId, folderId ?? null);

    return c.json(updatedFile);
  },
);

export default drive;
