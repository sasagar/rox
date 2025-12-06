/**
 * Custom Emoji Routes
 *
 * Public API endpoints for custom emojis.
 * List endpoints are public, management endpoints require admin.
 *
 * @module routes/emojis
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { generateId } from "shared";
import type { ICustomEmojiRepository } from "../interfaces/repositories/ICustomEmojiRepository.js";
import type { IFileStorage } from "../interfaces/IFileStorage.js";
import { logger } from "../lib/logger.js";

/** Allowed emoji file types */
const ALLOWED_MIME_TYPES = ["image/png", "image/gif", "image/webp", "image/apng"];

/** Maximum emoji file size (256KB) */
const MAX_EMOJI_SIZE = 256 * 1024;

const app = new Hono();

/**
 * List All Local Emojis
 *
 * GET /api/emojis
 *
 * Returns all local custom emojis for use in posts and reactions.
 * This is a public endpoint - no authentication required.
 *
 * Query params:
 * - category: Filter by category
 * - search: Search by name
 * - limit: Max results (default: 100)
 * - offset: Pagination offset
 */
app.get("/", async (c: Context) => {
  const customEmojiRepository = c.get("customEmojiRepository") as ICustomEmojiRepository;

  const category = c.req.query("category");
  const search = c.req.query("search");
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 500);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  const emojis = await customEmojiRepository.list({
    host: null, // Local emojis only
    category: category || undefined,
    search: search || undefined,
    limit,
    offset,
    includeSensitive: false,
  });

  // Transform to API response format
  const response = emojis.map((emoji) => ({
    id: emoji.id,
    name: emoji.name,
    category: emoji.category,
    aliases: emoji.aliases,
    url: emoji.publicUrl || emoji.url,
    isSensitive: emoji.isSensitive,
  }));

  return c.json({ emojis: response });
});

/**
 * List Emoji Categories
 *
 * GET /api/emojis/categories
 *
 * Returns all available emoji categories.
 */
app.get("/categories", async (c: Context) => {
  const customEmojiRepository = c.get("customEmojiRepository") as ICustomEmojiRepository;

  const categories = await customEmojiRepository.listCategories();

  return c.json({ categories });
});

/**
 * Get Emojis by Names
 *
 * POST /api/emojis/lookup
 *
 * Bulk lookup emojis by name for efficient fetching.
 * Used by MFM renderer to resolve custom emoji URLs.
 *
 * Body: { names: string[] }
 */
app.post("/lookup", async (c: Context) => {
  const customEmojiRepository = c.get("customEmojiRepository") as ICustomEmojiRepository;

  const body = await c.req.json<{ names?: string[] }>();

  if (!body.names || !Array.isArray(body.names) || body.names.length === 0) {
    return c.json({ emojis: {} });
  }

  // Limit to 100 names per request
  const names = body.names.slice(0, 100);

  const emojiMap = await customEmojiRepository.findManyByNames(names, null);

  // Transform to simple name -> URL mapping
  const response: Record<string, string> = {};
  for (const [name, emoji] of emojiMap) {
    response[name] = emoji.publicUrl || emoji.url;
  }

  return c.json({ emojis: response });
});

/**
 * Get Single Emoji by ID
 *
 * GET /api/emojis/:id
 */
app.get("/:id", async (c: Context) => {
  const customEmojiRepository = c.get("customEmojiRepository") as ICustomEmojiRepository;
  const id = c.req.param("id");

  const emoji = await customEmojiRepository.findById(id);

  if (!emoji) {
    return c.json({ error: "Emoji not found" }, 404);
  }

  return c.json({
    id: emoji.id,
    name: emoji.name,
    category: emoji.category,
    aliases: emoji.aliases,
    url: emoji.publicUrl || emoji.url,
    isSensitive: emoji.isSensitive,
    license: emoji.license,
  });
});

// === Admin Endpoints (require authentication and admin role) ===

/**
 * Upload Emoji File (Admin)
 *
 * POST /api/emojis/upload
 *
 * Uploads an emoji image file to the dedicated emojis directory.
 * Returns the URL of the uploaded file for use with /create endpoint.
 * Files are NOT associated with any user - they are instance-owned resources.
 *
 * Requires admin role.
 * Accepts multipart/form-data with 'file' field.
 */
app.post("/upload", async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check admin permission
  const roleService = c.get("roleService");
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: "Forbidden: Admin permission required" }, 403);
  }

  const fileStorage = c.get("fileStorage") as IFileStorage;

  // Parse multipart form data
  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return c.json({ error: "No file provided" }, 400);
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return c.json(
      {
        error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
      },
      400,
    );
  }

  // Validate file size
  if (file.size > MAX_EMOJI_SIZE) {
    return c.json(
      {
        error: `File too large. Maximum size: ${MAX_EMOJI_SIZE / 1024}KB`,
      },
      400,
    );
  }

  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Save to dedicated emojis directory (not user-specific)
  const filePath = await fileStorage.saveEmoji(buffer, {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  // Get public URL
  const url = fileStorage.getUrl(filePath);

  return c.json(
    {
      url,
      filePath,
      type: file.type,
      size: file.size,
    },
    201,
  );
});

/**
 * Create New Emoji (Admin)
 *
 * POST /api/emojis/create
 *
 * Requires admin role.
 */
app.post("/create", async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check admin permission
  const roleService = c.get("roleService");
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: "Forbidden: Admin permission required" }, 403);
  }

  const customEmojiRepository = c.get("customEmojiRepository") as ICustomEmojiRepository;

  const body = await c.req.json<{
    name: string;
    url: string;
    category?: string;
    aliases?: string[];
    license?: string;
    isSensitive?: boolean;
    localOnly?: boolean;
  }>();

  // Validate required fields
  if (!body.name || !body.url) {
    return c.json({ error: "Name and URL are required" }, 400);
  }

  // Validate name format (alphanumeric and underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(body.name)) {
    return c.json({ error: "Emoji name must contain only letters, numbers, and underscores" }, 400);
  }

  // Check if name already exists
  const exists = await customEmojiRepository.exists(body.name, null);
  if (exists) {
    return c.json({ error: "Emoji with this name already exists" }, 409);
  }

  const emoji = await customEmojiRepository.create({
    id: generateId(),
    name: body.name.toLowerCase(),
    host: null, // Local emoji
    url: body.url,
    publicUrl: body.url,
    category: body.category || null,
    aliases: body.aliases || [],
    license: body.license || null,
    isSensitive: body.isSensitive || false,
    localOnly: body.localOnly || false,
  });

  return c.json(
    {
      id: emoji.id,
      name: emoji.name,
      category: emoji.category,
      aliases: emoji.aliases,
      url: emoji.publicUrl || emoji.url,
      isSensitive: emoji.isSensitive,
    },
    201,
  );
});

/**
 * Update Emoji (Admin)
 *
 * PATCH /api/emojis/:id
 */
app.patch("/:id", async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const roleService = c.get("roleService");
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: "Forbidden: Admin permission required" }, 403);
  }

  const customEmojiRepository = c.get("customEmojiRepository") as ICustomEmojiRepository;
  const id = c.req.param("id");

  const body = await c.req.json<{
    name?: string;
    category?: string;
    aliases?: string[];
    license?: string;
    isSensitive?: boolean;
    localOnly?: boolean;
  }>();

  // Validate name format if provided
  if (body.name && !/^[a-zA-Z0-9_]+$/.test(body.name)) {
    return c.json({ error: "Emoji name must contain only letters, numbers, and underscores" }, 400);
  }

  const emoji = await customEmojiRepository.update(id, {
    name: body.name?.toLowerCase(),
    category: body.category,
    aliases: body.aliases,
    license: body.license,
    isSensitive: body.isSensitive,
    localOnly: body.localOnly,
  });

  if (!emoji) {
    return c.json({ error: "Emoji not found" }, 404);
  }

  return c.json({
    id: emoji.id,
    name: emoji.name,
    category: emoji.category,
    aliases: emoji.aliases,
    url: emoji.publicUrl || emoji.url,
    isSensitive: emoji.isSensitive,
  });
});

/**
 * Delete Emoji (Admin)
 *
 * DELETE /api/emojis/:id
 */
app.delete("/:id", async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const roleService = c.get("roleService");
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: "Forbidden: Admin permission required" }, 403);
  }

  const customEmojiRepository = c.get("customEmojiRepository") as ICustomEmojiRepository;
  const id = c.req.param("id");

  const deleted = await customEmojiRepository.delete(id);

  if (!deleted) {
    return c.json({ error: "Emoji not found" }, 404);
  }

  return c.json({ success: true });
});

// === Remote Emoji Management (Admin) ===

/**
 * List Remote Emojis (Admin)
 *
 * GET /api/emojis/remote
 *
 * Returns all remote custom emojis saved from incoming reactions.
 * These can be adopted as local emojis.
 *
 * Query params:
 * - host: Filter by remote host
 * - search: Search by name
 * - limit: Max results (default: 100)
 * - offset: Pagination offset
 */
app.get("/remote", async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const roleService = c.get("roleService");
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: "Forbidden: Admin permission required" }, 403);
  }

  const customEmojiRepository = c.get("customEmojiRepository") as ICustomEmojiRepository;

  const host = c.req.query("host");
  const search = c.req.query("search");
  const limit = Math.min(parseInt(c.req.query("limit") || "100", 10), 500);
  const offset = parseInt(c.req.query("offset") || "0", 10);

  // Get all remote emojis (host is NOT null)
  // We need to use list with a special query to get remote emojis
  const emojis = await customEmojiRepository.list({
    host: host || undefined, // If host specified, filter by it
    search: search || undefined,
    limit,
    offset,
    includeSensitive: true,
  });

  // Filter to only remote emojis (host is not null)
  const remoteEmojis = host ? emojis : emojis.filter((e) => e.host !== null);

  // Get unique hosts for filtering UI
  const hosts = [...new Set(remoteEmojis.map((e) => e.host).filter(Boolean))] as string[];

  const response = remoteEmojis.map((emoji) => ({
    id: emoji.id,
    name: emoji.name,
    host: emoji.host,
    url: emoji.publicUrl || emoji.url,
    category: emoji.category,
    isSensitive: emoji.isSensitive,
    createdAt: emoji.createdAt,
  }));

  return c.json({
    emojis: response,
    hosts,
    total: remoteEmojis.length,
  });
});

/**
 * Adopt Remote Emoji as Local (Admin)
 *
 * POST /api/emojis/adopt
 *
 * Downloads a remote emoji and creates it as a local emoji.
 * The original remote emoji record is kept for reference.
 *
 * Body:
 * - id: Remote emoji ID to adopt
 * - name: Optional new name (defaults to original)
 * - category: Optional category
 * - aliases: Optional aliases
 */
app.post("/adopt", async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const roleService = c.get("roleService");
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: "Forbidden: Admin permission required" }, 403);
  }

  const customEmojiRepository = c.get("customEmojiRepository") as ICustomEmojiRepository;
  const fileStorage = c.get("fileStorage") as IFileStorage;

  const body = await c.req.json<{
    id: string;
    name?: string;
    category?: string;
    aliases?: string[];
  }>();

  if (!body.id) {
    return c.json({ error: "Emoji ID is required" }, 400);
  }

  // Find the remote emoji
  const remoteEmoji = await customEmojiRepository.findById(body.id);
  if (!remoteEmoji) {
    return c.json({ error: "Remote emoji not found" }, 404);
  }

  if (!remoteEmoji.host) {
    return c.json({ error: "This emoji is already a local emoji" }, 400);
  }

  // Determine new name
  const newName = (body.name || remoteEmoji.name).toLowerCase();

  // Validate name format
  if (!/^[a-zA-Z0-9_]+$/.test(newName)) {
    return c.json({ error: "Emoji name must contain only letters, numbers, and underscores" }, 400);
  }

  // Check if name already exists locally
  const exists = await customEmojiRepository.exists(newName, null);
  if (exists) {
    return c.json({ error: `Local emoji with name "${newName}" already exists` }, 409);
  }

  // Download the remote emoji image
  const remoteUrl = remoteEmoji.publicUrl || remoteEmoji.url;
  let imageBuffer: Buffer;
  let contentType: string;

  try {
    const response = await fetch(remoteUrl, {
      headers: {
        "User-Agent": "Rox/1.0 (ActivityPub)",
      },
    });

    if (!response.ok) {
      return c.json({ error: `Failed to download emoji: ${response.status}` }, 502);
    }

    contentType = response.headers.get("content-type") || "image/png";
    const arrayBuffer = await response.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);

    // Validate file size
    if (imageBuffer.length > MAX_EMOJI_SIZE) {
      return c.json(
        { error: `Emoji file too large. Maximum size: ${MAX_EMOJI_SIZE / 1024}KB` },
        400,
      );
    }

    // Validate content type
    if (!ALLOWED_MIME_TYPES.includes(contentType)) {
      // Try to detect from URL extension
      const ext = remoteUrl.split(".").pop()?.toLowerCase().split("?")[0];
      const mimeFromExt: Record<string, string> = {
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        apng: "image/apng",
      };
      if (ext && mimeFromExt[ext]) {
        contentType = mimeFromExt[ext];
      }
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to download remote emoji");
    return c.json({ error: "Failed to download remote emoji" }, 502);
  }

  // Determine file extension
  const extMap: Record<string, string> = {
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/apng": "png",
  };
  const ext = extMap[contentType] || "png";

  // Save to local storage
  const filePath = await fileStorage.saveEmoji(imageBuffer, {
    name: `${newName}.${ext}`,
    type: contentType,
    size: imageBuffer.length,
  });

  const localUrl = fileStorage.getUrl(filePath);

  // Create local emoji
  const localEmoji = await customEmojiRepository.create({
    id: generateId(),
    name: newName,
    host: null, // Local emoji
    url: localUrl,
    publicUrl: localUrl,
    category: body.category || remoteEmoji.category || null,
    aliases: body.aliases || remoteEmoji.aliases || [],
    license: remoteEmoji.license || null,
    isSensitive: remoteEmoji.isSensitive || false,
    localOnly: false,
  });

  logger.info({ remoteEmojiName: remoteEmoji.name, host: remoteEmoji.host, newName }, "Adopted remote emoji as local");

  return c.json(
    {
      id: localEmoji.id,
      name: localEmoji.name,
      category: localEmoji.category,
      aliases: localEmoji.aliases,
      url: localEmoji.publicUrl || localEmoji.url,
      adoptedFrom: {
        name: remoteEmoji.name,
        host: remoteEmoji.host,
      },
    },
    201,
  );
});

/**
 * Bulk Import Emojis from ZIP (Admin)
 *
 * POST /api/emojis/import
 *
 * Imports multiple emojis from a ZIP file.
 *
 * ZIP structure:
 * - meta.json (required): Array of emoji definitions
 * - *.png, *.gif, *.webp: Emoji image files
 *
 * meta.json format:
 * [
 *   {
 *     "name": "emoji_name",
 *     "file": "emoji_name.png",
 *     "category": "optional_category",
 *     "aliases": ["alias1", "alias2"],
 *     "license": "optional_license",
 *     "isSensitive": false
 *   }
 * ]
 *
 * If meta.json is not provided, emojis are created from filenames.
 */
app.post("/import", async (c: Context) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const roleService = c.get("roleService");
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: "Forbidden: Admin permission required" }, 403);
  }

  const customEmojiRepository = c.get("customEmojiRepository") as ICustomEmojiRepository;
  const fileStorage = c.get("fileStorage") as IFileStorage;

  // Parse multipart form data
  const body = await c.req.parseBody();
  const zipFile = body.file as File;

  if (!zipFile) {
    return c.json({ error: "No file provided" }, 400);
  }

  if (!zipFile.name.endsWith(".zip") && zipFile.type !== "application/zip") {
    return c.json({ error: "File must be a ZIP archive" }, 400);
  }

  // Maximum ZIP size: 50MB
  const MAX_ZIP_SIZE = 50 * 1024 * 1024;
  if (zipFile.size > MAX_ZIP_SIZE) {
    return c.json({ error: `ZIP file too large. Maximum size: ${MAX_ZIP_SIZE / 1024 / 1024}MB` }, 400);
  }

  const arrayBuffer = await zipFile.arrayBuffer();

  // Import JSZip dynamically
  const JSZip = (await import("jszip")).default;
  let zip: InstanceType<typeof JSZip>;

  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch {
    return c.json({ error: "Invalid ZIP file" }, 400);
  }

  // Look for meta.json
  interface EmojiMeta {
    name: string;
    file: string;
    category?: string;
    aliases?: string[];
    license?: string;
    isSensitive?: boolean;
  }

  let emojiMetas: EmojiMeta[] = [];
  const metaFile = zip.file("meta.json");

  if (metaFile) {
    try {
      const metaContent = await metaFile.async("string");
      const parsed = JSON.parse(metaContent);
      if (Array.isArray(parsed)) {
        emojiMetas = parsed;
      } else if (parsed.emojis && Array.isArray(parsed.emojis)) {
        emojiMetas = parsed.emojis;
      }
    } catch {
      return c.json({ error: "Invalid meta.json format" }, 400);
    }
  } else {
    // No meta.json - create entries from image files
    const imageFiles = Object.keys(zip.files).filter((name) => {
      const ext = name.split(".").pop()?.toLowerCase();
      return ["png", "gif", "webp", "apng"].includes(ext || "");
    });

    emojiMetas = imageFiles.map((file) => {
      const name = file.split("/").pop()?.replace(/\.[^.]+$/, "") || "";
      return {
        name: name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        file,
      };
    });
  }

  if (emojiMetas.length === 0) {
    return c.json({ error: "No emoji definitions found in ZIP" }, 400);
  }

  // Process each emoji
  const results: {
    success: { name: string; id: string }[];
    failed: { name: string; error: string }[];
    skipped: { name: string; reason: string }[];
  } = {
    success: [],
    failed: [],
    skipped: [],
  };

  for (const meta of emojiMetas) {
    // Validate name
    if (!meta.name || !/^[a-zA-Z0-9_]+$/.test(meta.name)) {
      results.failed.push({
        name: meta.name || "(unknown)",
        error: "Invalid emoji name",
      });
      continue;
    }

    const emojiName = meta.name.toLowerCase();

    // Check if already exists
    const exists = await customEmojiRepository.exists(emojiName, null);
    if (exists) {
      results.skipped.push({
        name: emojiName,
        reason: "Already exists",
      });
      continue;
    }

    // Find the image file
    const imageFile = zip.file(meta.file);
    if (!imageFile) {
      results.failed.push({
        name: emojiName,
        error: `File not found: ${meta.file}`,
      });
      continue;
    }

    try {
      const imageBuffer = Buffer.from(await imageFile.async("arraybuffer"));

      // Validate size
      if (imageBuffer.length > MAX_EMOJI_SIZE) {
        results.failed.push({
          name: emojiName,
          error: `File too large (${Math.round(imageBuffer.length / 1024)}KB)`,
        });
        continue;
      }

      // Determine content type
      const ext = meta.file.split(".").pop()?.toLowerCase();
      const mimeMap: Record<string, string> = {
        png: "image/png",
        gif: "image/gif",
        webp: "image/webp",
        apng: "image/apng",
      };
      const contentType = mimeMap[ext || ""] || "image/png";

      // Save to storage
      const filePath = await fileStorage.saveEmoji(imageBuffer, {
        name: `${emojiName}.${ext || "png"}`,
        type: contentType,
        size: imageBuffer.length,
      });

      const localUrl = fileStorage.getUrl(filePath);

      // Create emoji record
      const emoji = await customEmojiRepository.create({
        id: generateId(),
        name: emojiName,
        host: null,
        url: localUrl,
        publicUrl: localUrl,
        category: meta.category || null,
        aliases: meta.aliases || [],
        license: meta.license || null,
        isSensitive: meta.isSensitive || false,
        localOnly: false,
      });

      results.success.push({
        name: emojiName,
        id: emoji.id,
      });
    } catch (error) {
      results.failed.push({
        name: emojiName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  logger.info(
    { success: results.success.length, skipped: results.skipped.length, failed: results.failed.length },
    "Emoji import complete",
  );

  return c.json({
    success: results.success.length,
    skipped: results.skipped.length,
    failed: results.failed.length,
    details: results,
  });
});

export default app;
