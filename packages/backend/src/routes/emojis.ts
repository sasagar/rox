/**
 * Custom Emoji Routes
 *
 * Public API endpoints for custom emojis.
 * List endpoints are public, management endpoints require admin.
 *
 * @module routes/emojis
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { generateId } from 'shared';
import type { ICustomEmojiRepository } from '../interfaces/repositories/ICustomEmojiRepository.js';
import type { IFileStorage } from '../interfaces/IFileStorage.js';

/** Allowed emoji file types */
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/gif',
  'image/webp',
  'image/apng',
];

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
app.get('/', async (c: Context) => {
  const customEmojiRepository = c.get('customEmojiRepository') as ICustomEmojiRepository;

  const category = c.req.query('category');
  const search = c.req.query('search');
  const limit = Math.min(parseInt(c.req.query('limit') || '100', 10), 500);
  const offset = parseInt(c.req.query('offset') || '0', 10);

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
app.get('/categories', async (c: Context) => {
  const customEmojiRepository = c.get('customEmojiRepository') as ICustomEmojiRepository;

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
app.post('/lookup', async (c: Context) => {
  const customEmojiRepository = c.get('customEmojiRepository') as ICustomEmojiRepository;

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
app.get('/:id', async (c: Context) => {
  const customEmojiRepository = c.get('customEmojiRepository') as ICustomEmojiRepository;
  const id = c.req.param('id');

  const emoji = await customEmojiRepository.findById(id);

  if (!emoji) {
    return c.json({ error: 'Emoji not found' }, 404);
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
app.post('/upload', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Check admin permission
  const roleService = c.get('roleService');
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: 'Forbidden: Admin permission required' }, 403);
  }

  const fileStorage = c.get('fileStorage') as IFileStorage;

  // Parse multipart form data
  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return c.json({ error: 'No file provided' }, 400);
  }

  // Validate file type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return c.json({
      error: `Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`,
    }, 400);
  }

  // Validate file size
  if (file.size > MAX_EMOJI_SIZE) {
    return c.json({
      error: `File too large. Maximum size: ${MAX_EMOJI_SIZE / 1024}KB`,
    }, 400);
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

  return c.json({
    url,
    filePath,
    type: file.type,
    size: file.size,
  }, 201);
});

/**
 * Create New Emoji (Admin)
 *
 * POST /api/emojis/create
 *
 * Requires admin role.
 */
app.post('/create', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // Check admin permission
  const roleService = c.get('roleService');
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: 'Forbidden: Admin permission required' }, 403);
  }

  const customEmojiRepository = c.get('customEmojiRepository') as ICustomEmojiRepository;

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
    return c.json({ error: 'Name and URL are required' }, 400);
  }

  // Validate name format (alphanumeric and underscores only)
  if (!/^[a-zA-Z0-9_]+$/.test(body.name)) {
    return c.json({ error: 'Emoji name must contain only letters, numbers, and underscores' }, 400);
  }

  // Check if name already exists
  const exists = await customEmojiRepository.exists(body.name, null);
  if (exists) {
    return c.json({ error: 'Emoji with this name already exists' }, 409);
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

  return c.json({
    id: emoji.id,
    name: emoji.name,
    category: emoji.category,
    aliases: emoji.aliases,
    url: emoji.publicUrl || emoji.url,
    isSensitive: emoji.isSensitive,
  }, 201);
});

/**
 * Update Emoji (Admin)
 *
 * PATCH /api/emojis/:id
 */
app.patch('/:id', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const roleService = c.get('roleService');
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: 'Forbidden: Admin permission required' }, 403);
  }

  const customEmojiRepository = c.get('customEmojiRepository') as ICustomEmojiRepository;
  const id = c.req.param('id');

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
    return c.json({ error: 'Emoji name must contain only letters, numbers, and underscores' }, 400);
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
    return c.json({ error: 'Emoji not found' }, 404);
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
app.delete('/:id', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const roleService = c.get('roleService');
  const policies = await roleService.getEffectivePolicies(user.id);
  if (!policies.canManageCustomEmojis) {
    return c.json({ error: 'Forbidden: Admin permission required' }, 403);
  }

  const customEmojiRepository = c.get('customEmojiRepository') as ICustomEmojiRepository;
  const id = c.req.param('id');

  const deleted = await customEmojiRepository.delete(id);

  if (!deleted) {
    return c.json({ error: 'Emoji not found' }, 404);
  }

  return c.json({ success: true });
});

export default app;
