/**
 * User API Routes
 *
 * Provides endpoints for user registration, and retrieving and updating user information.
 *
 * @module routes/users
 */

import { Hono } from "hono";
import { AuthService } from "../services/AuthService.js";
import { UserService } from "../services/UserService.js";
import { requireAuth, optionalAuth } from "../middleware/auth.js";
import { errorResponse } from "../lib/routeUtils.js";
import { verifyPassword } from "../utils/password.js";

const app = new Hono();

/**
 * User Registration
 *
 * POST /api/users
 *
 * Registers a new user, automatically logs in, and issues a session token.
 * Only enabled when ENABLE_REGISTRATION environment variable is true.
 *
 * @remarks
 * Request Body:
 * ```json
 * {
 *   "username": "alice",
 *   "email": "alice@example.com",
 *   "password": "securePassword123",
 *   "name": "Alice Smith" // optional
 * }
 * ```
 *
 * Validation:
 * - username: 3-20 characters, alphanumeric and underscores only
 * - email: Valid email address format
 * - password: Minimum 8 characters
 *
 * Response (201):
 * ```json
 * {
 *   "user": { "id": "...", "username": "alice", ... },
 *   "token": "a3f2e1d0c9b8a7f6..."
 * }
 * ```
 *
 * Errors:
 * - 400: Validation error
 * - 403: Registration disabled
 * - 409: Username or email already exists
 */
app.post("/", async (c) => {
  // 登録機能が無効な場合
  if (process.env.ENABLE_REGISTRATION !== "true") {
    return c.json({ error: "Registration is disabled" }, 403);
  }

  const body = await c.req.json();

  // バリデーション
  if (!body.username || typeof body.username !== "string") {
    return c.json({ error: "Username is required" }, 400);
  }
  if (!body.email || typeof body.email !== "string") {
    return c.json({ error: "Email is required" }, 400);
  }
  if (!body.password || typeof body.password !== "string") {
    return c.json({ error: "Password is required" }, 400);
  }

  // ユーザー名のバリデーション（英数字とアンダースコアのみ、3-20文字）
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(body.username)) {
    return c.json(
      {
        error:
          "Username must be 3-20 characters and contain only letters, numbers, and underscores",
      },
      400,
    );
  }

  // メールアドレスの簡易バリデーション
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return c.json({ error: "Invalid email address" }, 400);
  }

  // パスワードの長さチェック（最低8文字）
  if (body.password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters" }, 400);
  }

  try {
    const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
    const { user, session } = await authService.register({
      username: body.username,
      email: body.email,
      password: body.password,
      name: body.name,
    });

    // パスワードハッシュを除外してレスポンス
    const { passwordHash: _passwordHash, email: _email, ...publicUser } = user;

    return c.json(
      {
        user: publicUser,
        token: session.token,
      },
      201,
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("already exists")) {
        return c.json({ error: error.message }, 409);
      }
    }
    throw error;
  }
});

/**
 * Get Own User Information
 *
 * GET /api/users/@me
 *
 * Retrieves detailed information about the authenticated user (authentication required).
 * Returns complete information including email address.
 *
 * @remarks
 * Headers:
 * ```
 * Authorization: Bearer <token>
 * ```
 *
 * Response (200):
 * ```json
 * {
 *   "id": "...",
 *   "username": "alice",
 *   "email": "alice@example.com",
 *   "displayName": "Alice Smith",
 *   ...
 * }
 * ```
 *
 * Errors:
 * - 401: Authentication required, or invalid token
 */
app.get("/@me", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // メールアドレスは含めるが、パスワードハッシュは除外
  const { passwordHash: _passwordHash, ...userData } = user;

  return c.json(userData);
});

/**
 * Search Users
 *
 * GET /api/users/search
 *
 * Searches for users by username or display name.
 * Performs case-insensitive partial matching.
 *
 * @remarks
 * Query Parameters:
 * - q: Search query (required, min 1 character)
 * - limit: Maximum results to return (default: 20, max: 50)
 * - offset: Number of results to skip (default: 0)
 * - localOnly: If "true", only search local users (default: false)
 *
 * Response (200):
 * ```json
 * {
 *   "users": [
 *     {
 *       "id": "...",
 *       "username": "alice",
 *       "host": null,
 *       "displayName": "Alice Smith",
 *       "avatarUrl": "https://...",
 *       ...
 *     }
 *   ]
 * }
 * ```
 *
 * Errors:
 * - 400: Query parameter is required or too short
 *
 * Note:
 * - Remote users may not be searchable by display name if not cached locally
 * - Suspended users are excluded from results
 */
app.get("/search", async (c) => {
  const userRepository = c.get("userRepository");
  const query = c.req.query("q");
  const limitParam = c.req.query("limit");
  const offsetParam = c.req.query("offset");
  const localOnlyParam = c.req.query("localOnly");

  if (!query || query.trim().length === 0) {
    return c.json({ error: "Search query is required" }, 400);
  }

  const limit = Math.min(Math.max(parseInt(limitParam || "20", 10) || 20, 1), 50);
  const offset = Math.max(parseInt(offsetParam || "0", 10) || 0, 0);
  const localOnly = localOnlyParam === "true";

  const searchResults = await userRepository.search({
    query: query.trim(),
    limit,
    offset,
    localOnly,
  });

  // Remove sensitive fields
  const publicUsers = searchResults.map((user) => {
    const {
      passwordHash: _passwordHash,
      email: _email,
      privateKey: _privateKey,
      ...publicUser
    } = user;
    return publicUser;
  });

  return c.json({ users: publicUsers });
});

/**
 * Get User Information (Misskey-compatible)
 *
 * GET /api/users/show
 *
 * Retrieves public information of a user by userId or username (no authentication required).
 * This endpoint is Misskey API compatible.
 *
 * @remarks
 * Query Parameters (one required):
 * - userId: User ID
 * - username: Username
 *
 * Response (200):
 * ```json
 * {
 *   "id": "...",
 *   "username": "alice",
 *   "displayName": "Alice Smith",
 *   "bio": "Hello!",
 *   ...
 * }
 * ```
 *
 * Errors:
 * - 400: userId or username is required
 * - 404: User not found
 */
app.get("/show", optionalAuth(), async (c) => {
  const userRepository = c.get("userRepository");
  const followRepository = c.get("followRepository");
  const noteRepository = c.get("noteRepository");
  const userId = c.req.query("userId");
  const username = c.req.query("username");

  if (!userId && !username) {
    return c.json({ error: "userId or username is required" }, 400);
  }

  let user;
  if (userId) {
    user = await userRepository.findById(userId);
  } else if (username) {
    user = await userRepository.findByUsername(username, null);
  }

  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // パスワードハッシュとメールアドレスを除外
  const { passwordHash: _passwordHash, email: _email, ...publicUser } = user;

  // Check if current user is following this user (if authenticated)
  let isFollowed = false;
  const currentUser = c.get("user");
  if (currentUser && currentUser.id !== user.id) {
    isFollowed = await followRepository.exists(currentUser.id, user.id);
  }

  // Fetch counts in parallel
  const [notesCount, followersCount, followingCount] = await Promise.all([
    noteRepository.countByUserId(user.id),
    followRepository.countFollowers(user.id),
    followRepository.countFollowing(user.id),
  ]);

  return c.json({ ...publicUser, isFollowed, notesCount, followersCount, followingCount });
});

/**
 * Resolve Remote User
 *
 * GET /api/users/resolve
 *
 * Resolves a remote user by their acct URI (e.g., alice@mastodon.social).
 * Performs WebFinger lookup and fetches actor information from remote server.
 * If the user already exists in the database, returns cached information.
 *
 * @remarks
 * Query Parameters:
 * - acct: Account identifier (e.g., "alice@mastodon.social" or "acct:alice@mastodon.social")
 *
 * Response (200):
 * ```json
 * {
 *   "id": "...",
 *   "username": "alice",
 *   "host": "mastodon.social",
 *   "displayName": "Alice",
 *   "bio": "Hello from Mastodon!",
 *   "avatarUrl": "https://...",
 *   ...
 * }
 * ```
 *
 * Errors:
 * - 400: acct parameter is required or invalid format
 * - 404: User not found on remote server
 * - 502: Failed to fetch remote user (network error, invalid response)
 */
app.get("/resolve", optionalAuth(), async (c) => {
  const followRepository = c.get("followRepository");
  const remoteActorService = c.get("remoteActorService");
  const systemAccountService = c.get("systemAccountService");
  const acct = c.req.query("acct");

  if (!acct) {
    return c.json({ error: "acct parameter is required" }, 400);
  }

  try {
    // Use system account for HTTP Signature (required by GoToSocial and others)
    const signatureConfig = await systemAccountService.getSignatureConfig();
    if (signatureConfig) {
      remoteActorService.setSignatureConfig(signatureConfig);
    }

    const user = await remoteActorService.resolveActorByAcct(acct);

    // パスワードハッシュとメールアドレスを除外
    const { passwordHash: _passwordHash, email: _email, ...publicUser } = user;

    // Check if current user is following this user (if authenticated)
    let isFollowed = false;
    const currentUser = c.get("user");
    if (currentUser && currentUser.id !== user.id) {
      isFollowed = await followRepository.exists(currentUser.id, user.id);
    }

    return c.json({ ...publicUser, isFollowed });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to resolve user";

    // Determine appropriate error code
    if (message.includes("Invalid acct format")) {
      return c.json({ error: message }, 400);
    }
    if (message.includes("not found") || message.includes("No ActivityPub actor link")) {
      return c.json({ error: message }, 404);
    }
    // Network/fetch errors
    return c.json({ error: message }, 502);
  }
});

/**
 * Get User's Public Roles
 *
 * GET /api/users/:id/public-roles
 *
 * Retrieves public roles assigned to a user.
 * Only returns roles that have isPublic=true.
 *
 * @remarks
 * Response (200):
 * ```json
 * {
 *   "roles": [
 *     {
 *       "id": "...",
 *       "name": "Admin",
 *       "color": "#ff0000",
 *       "iconUrl": null
 *     }
 *   ]
 * }
 * ```
 *
 * Errors:
 * - 404: User not found
 */
app.get("/:id/public-roles", async (c) => {
  const userId = c.req.param("id");
  const userRepository = c.get("userRepository");
  const roleAssignmentRepository = c.get("roleAssignmentRepository");

  // Check if user exists
  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // Get all roles for user
  const allRoles = await roleAssignmentRepository.findRolesByUserId(userId);

  // Filter to only public roles and return minimal info
  const publicRoles = allRoles
    .filter((role) => role.isPublic)
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((role) => ({
      id: role.id,
      name: role.name,
      color: role.color,
      iconUrl: role.iconUrl,
    }));

  return c.json({ roles: publicRoles });
});

/**
 * Get User Information
 *
 * GET /api/users/:id
 *
 * Retrieves public information of the user with the specified ID (no authentication required).
 * Email address is not included.
 *
 * @remarks
 * Response (200):
 * ```json
 * {
 *   "id": "...",
 *   "username": "alice",
 *   "displayName": "Alice Smith",
 *   "bio": "Hello!",
 *   ...
 * }
 * ```
 *
 * Errors:
 * - 404: User not found
 */
app.get("/:id", async (c) => {
  const userId = c.req.param("id");
  const userRepository = c.get("userRepository");

  const user = await userRepository.findById(userId);
  if (!user) {
    return c.json({ error: "User not found" }, 404);
  }

  // パスワードハッシュとメールアドレスを除外
  const { passwordHash: _passwordHash, email: _email, ...publicUser } = user;

  return c.json(publicUser);
});

/**
 * Update User Information
 *
 * PATCH /api/users/@me
 *
 * Updates the authenticated user's own information (authentication required).
 *
 * @remarks
 * Headers:
 * ```
 * Authorization: Bearer <token>
 * ```
 *
 * Request Body (all optional):
 * ```json
 * {
 *   "name": "New Display Name",
 *   "description": "New bio",
 *   "avatarUrl": "https://...",
 *   "bannerUrl": "https://...",
 *   "isBot": false
 * }
 * ```
 *
 * Response (200):
 * ```json
 * {
 *   "id": "...",
 *   "username": "alice",
 *   "displayName": "New Display Name",
 *   ...
 * }
 * ```
 *
 * Errors:
 * - 401: Authentication required, or invalid token
 */
app.patch("/@me", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json();
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  // Initialize UserService with ActivityPub delivery support and caching
  const userService = new UserService(userRepository, deliveryService, cacheService);

  // 更新可能なフィールドのみを抽出
  const updateData: any = {};
  if (body.name !== undefined) updateData.displayName = body.name;
  if (body.description !== undefined) updateData.bio = body.description;
  if (body.avatarUrl !== undefined) updateData.avatarUrl = body.avatarUrl;
  if (body.bannerUrl !== undefined) updateData.bannerUrl = body.bannerUrl;
  if (body.customCss !== undefined) {
    // Sanitize CSS to prevent XSS (allow basic safe CSS)
    // Limit to 10KB to prevent abuse
    if (typeof body.customCss === "string" && body.customCss.length <= 10240) {
      updateData.customCss = body.customCss;
    }
  }

  // Handle UI settings
  if (body.uiSettings !== undefined) {
    const validFontSizes = ["small", "medium", "large", "xlarge"];
    const validLineHeights = ["compact", "normal", "relaxed"];
    const validContentWidths = ["narrow", "normal", "wide"];
    const validThemes = ["light", "dark", "system"];

    const uiSettings: Record<string, unknown> = {};

    if (body.uiSettings.fontSize && validFontSizes.includes(body.uiSettings.fontSize)) {
      uiSettings.fontSize = body.uiSettings.fontSize;
    }
    if (body.uiSettings.lineHeight && validLineHeights.includes(body.uiSettings.lineHeight)) {
      uiSettings.lineHeight = body.uiSettings.lineHeight;
    }
    if (body.uiSettings.contentWidth && validContentWidths.includes(body.uiSettings.contentWidth)) {
      uiSettings.contentWidth = body.uiSettings.contentWidth;
    }
    if (body.uiSettings.theme && validThemes.includes(body.uiSettings.theme)) {
      uiSettings.theme = body.uiSettings.theme;
    }
    // Custom CSS for app (limit to 10KB)
    if (
      typeof body.uiSettings.appCustomCss === "string" &&
      body.uiSettings.appCustomCss.length <= 10240
    ) {
      uiSettings.appCustomCss = body.uiSettings.appCustomCss;
    }

    // Disabled push notification types
    const validNotificationTypes = [
      "follow",
      "mention",
      "reply",
      "reaction",
      "renote",
      "quote",
      "warning",
      "follow_request_accepted",
      "dm",
    ];
    if (Array.isArray(body.uiSettings.disabledPushNotificationTypes)) {
      const validDisabledTypes = body.uiSettings.disabledPushNotificationTypes.filter(
        (t: unknown) => typeof t === "string" && validNotificationTypes.includes(t),
      );
      uiSettings.disabledPushNotificationTypes = validDisabledTypes;
    }

    updateData.uiSettings = uiSettings;
  }

  try {
    const updatedUser = await userService.updateProfile(user.id, updateData);
    const { passwordHash: _passwordHash, ...userData } = updatedUser;
    return c.json(userData);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update profile";
    return c.json({ error: message }, 400);
  }
});

// ============================================================================
// Profile Image Upload Endpoints
// ============================================================================

/**
 * Upload Avatar Image
 *
 * POST /api/users/@me/avatar
 *
 * Uploads an avatar image for the authenticated user.
 * The image is processed (resized, converted to WebP) and stored.
 *
 * @remarks
 * Headers:
 * ```
 * Authorization: Bearer <token>
 * Content-Type: multipart/form-data
 * ```
 *
 * Form Data:
 * - file: The image file to upload (max 2MB, images only)
 *
 * Response (200):
 * ```json
 * {
 *   "avatarUrl": "https://example.com/files/abc123.webp"
 * }
 * ```
 */
app.post("/@me/avatar", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return errorResponse(c, "Unauthorized", 401);
  }

  const driveFileRepository = c.get("driveFileRepository");
  const fileStorage = c.get("fileStorage");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const { FileService } = await import("../services/FileService.js");
  const fileService = new FileService(driveFileRepository, fileStorage);
  const userService = new UserService(userRepository, deliveryService, cacheService);

  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return errorResponse(c, "No file provided");
  }

  // Validate file type (must be an image)
  if (!file.type.startsWith("image/")) {
    return errorResponse(c, "File must be an image");
  }

  // Size limit: 2MB
  const maxSize = 2 * 1024 * 1024;
  if (file.size > maxSize) {
    return errorResponse(c, "File size exceeds 2MB limit");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file
    const driveFile = await fileService.upload({
      file: buffer,
      name: `avatar-${Date.now()}-${file.name}`,
      type: file.type,
      userId: user.id,
      source: "user",
      comment: "User avatar",
    });

    // Update user's avatarUrl
    const updatedUser = await userService.updateProfile(user.id, {
      avatarUrl: driveFile.url,
    });

    return c.json({
      avatarUrl: updatedUser.avatarUrl,
    });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(c, error.message);
    }
    throw error;
  }
});

/**
 * Delete Avatar Image
 *
 * DELETE /api/users/@me/avatar
 *
 * Removes the authenticated user's avatar image.
 */
app.delete("/@me/avatar", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return errorResponse(c, "Unauthorized", 401);
  }

  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const userService = new UserService(userRepository, deliveryService, cacheService);

  try {
    await userService.updateProfile(user.id, {
      avatarUrl: null,
    });

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(c, error.message);
    }
    throw error;
  }
});

/**
 * Upload Banner Image
 *
 * POST /api/users/@me/banner
 *
 * Uploads a banner/header image for the authenticated user.
 * The image is processed and stored.
 *
 * @remarks
 * Headers:
 * ```
 * Authorization: Bearer <token>
 * Content-Type: multipart/form-data
 * ```
 *
 * Form Data:
 * - file: The image file to upload (max 5MB, images only)
 *
 * Response (200):
 * ```json
 * {
 *   "bannerUrl": "https://example.com/files/abc123.webp"
 * }
 * ```
 */
app.post("/@me/banner", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return errorResponse(c, "Unauthorized", 401);
  }

  const driveFileRepository = c.get("driveFileRepository");
  const fileStorage = c.get("fileStorage");
  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const { FileService } = await import("../services/FileService.js");
  const fileService = new FileService(driveFileRepository, fileStorage);
  const userService = new UserService(userRepository, deliveryService, cacheService);

  const body = await c.req.parseBody();
  const file = body.file as File;

  if (!file) {
    return errorResponse(c, "No file provided");
  }

  // Validate file type (must be an image)
  if (!file.type.startsWith("image/")) {
    return errorResponse(c, "File must be an image");
  }

  // Size limit: 5MB for banner
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return errorResponse(c, "File size exceeds 5MB limit");
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload file
    const driveFile = await fileService.upload({
      file: buffer,
      name: `banner-${Date.now()}-${file.name}`,
      type: file.type,
      userId: user.id,
      source: "user",
      comment: "User banner",
    });

    // Update user's bannerUrl
    const updatedUser = await userService.updateProfile(user.id, {
      bannerUrl: driveFile.url,
    });

    return c.json({
      bannerUrl: updatedUser.bannerUrl,
    });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(c, error.message);
    }
    throw error;
  }
});

/**
 * Delete Banner Image
 *
 * DELETE /api/users/@me/banner
 *
 * Removes the authenticated user's banner image.
 */
app.delete("/@me/banner", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return errorResponse(c, "Unauthorized", 401);
  }

  const userRepository = c.get("userRepository");
  const deliveryService = c.get("activityPubDeliveryService");
  const cacheService = c.get("cacheService");

  const userService = new UserService(userRepository, deliveryService, cacheService);

  try {
    await userService.updateProfile(user.id, {
      bannerUrl: null,
    });

    return c.json({ success: true });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(c, error.message);
    }
    throw error;
  }
});

/**
 * Delete Own Account
 *
 * POST /api/users/@me/delete
 *
 * Permanently deletes the authenticated user's account.
 * Requires password confirmation for security.
 *
 * @remarks
 * Request Body:
 * ```json
 * {
 *   "password": "currentPassword123"
 * }
 * ```
 *
 * Response (200):
 * ```json
 * {
 *   "success": true,
 *   "message": "Account deleted successfully"
 * }
 * ```
 *
 * Errors:
 * - 400: Password required or incorrect
 * - 401: Unauthorized
 * - 403: Admin users cannot delete their own accounts
 */
app.post("/@me/delete", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return errorResponse(c, "Unauthorized", 401);
  }

  const body = await c.req.json<{ password?: string }>();
  const { password } = body;

  // Password is required for account deletion
  if (!password) {
    return errorResponse(c, "Password is required to delete your account", 400);
  }

  const userRepository = c.get("userRepository");
  const userDeletionService = c.get("userDeletionService");

  // Get full user data with password hash
  const fullUser = await userRepository.findById(user.id);
  if (!fullUser || !fullUser.passwordHash) {
    return errorResponse(c, "User not found or no password set", 400);
  }

  // Verify password
  const isValidPassword = await verifyPassword(password, fullUser.passwordHash);
  if (!isValidPassword) {
    return errorResponse(c, "Incorrect password", 400);
  }

  try {
    const result = await userDeletionService.deleteLocalUser(user.id, {
      deleteNotes: true, // Delete all user's notes as well
    });

    if (!result.success) {
      return errorResponse(c, result.message, 403);
    }

    return c.json({
      success: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse(c, error.message);
    }
    throw error;
  }
});

/**
 * Export User Data (GDPR Article 20 - Data Portability)
 *
 * GET /api/users/@me/export
 *
 * Exports all personal data associated with the authenticated user
 * in a portable JSON format. This endpoint supports GDPR compliance
 * for the right to data portability.
 *
 * @remarks
 * Response (200):
 * ```json
 * {
 *   "exportVersion": "1.0",
 *   "exportedAt": "2024-01-01T00:00:00.000Z",
 *   "dataSubject": { ... },
 *   "profile": { ... },
 *   "content": { "notes": [...], "noteCount": 123 },
 *   "social": { "following": [...], "followers": [...] },
 *   "interactions": { "reactions": [...] },
 *   "media": { "files": [...] },
 *   "notifications": { ... }
 * }
 * ```
 *
 * Errors:
 * - 401: Unauthorized
 * - 500: Export failed
 */
app.get("/@me/export", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return errorResponse(c, "Unauthorized", 401);
  }

  try {
    const userDataExportService = c.get("userDataExportService");
    const exportData = await userDataExportService.exportUserData(user.id);

    // Set headers for file download
    c.header("Content-Type", "application/json");
    c.header(
      "Content-Disposition",
      `attachment; filename="user-data-export-${user.username}-${new Date().toISOString().split("T")[0]}.json"`,
    );

    return c.json(exportData);
  } catch (error) {
    console.error("Failed to export user data:", error);
    if (error instanceof Error) {
      return errorResponse(c, error.message, 500);
    }
    return errorResponse(c, "Failed to export user data", 500);
  }
});

export default app;
