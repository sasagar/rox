/**
 * Authentication API Routes
 *
 * Provides endpoints for login, logout, session validation, and passkey authentication.
 *
 * @module routes/auth
 */

import { Hono } from "hono";
import { AuthService } from "../services/AuthService.js";
import { PasskeyService } from "../services/PasskeyService.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit, RateLimitPresets } from "../middleware/rateLimit.js";
import { logger } from "../lib/logger.js";
import type { Context } from "hono";

const app = new Hono();

/**
 * Check if registration requires an invitation code
 * Uses DB setting first, falls back to environment variable
 */
const checkIsInviteOnly = async (c: Context): Promise<boolean> => {
  // First check DB setting
  const instanceSettingsService = c.get("instanceSettingsService");
  const dbSetting = await instanceSettingsService.isInviteOnly();

  // If DB says invite-only, use that
  if (dbSetting) return true;

  // Fall back to environment variable for backwards compatibility
  const requireInvitation = process.env.REQUIRE_INVITATION;
  return requireInvitation === "true" || requireInvitation === "1";
};

/**
 * Check if registration is enabled
 * Uses DB setting first, falls back to environment variable
 */
const checkIsRegistrationEnabled = async (c: Context): Promise<boolean> => {
  const instanceSettingsService = c.get("instanceSettingsService");
  const dbSetting = await instanceSettingsService.isRegistrationEnabled();

  // If DB setting exists and is false, registration is disabled
  // Fall back to env var ENABLE_REGISTRATION if DB doesn't have a setting
  if (!dbSetting) {
    const envSetting = process.env.ENABLE_REGISTRATION;
    // If env var is explicitly 'false' or '0', registration is disabled
    if (envSetting === "false" || envSetting === "0") return false;
  }

  return dbSetting;
};

/**
 * Registration Settings
 *
 * GET /api/auth/register/settings
 *
 * Returns registration settings (registration enabled, invite-only mode status)
 */
app.get("/register/settings", async (c) => {
  const instanceSettingsService = c.get("instanceSettingsService");

  const [registrationEnabled, inviteOnly, approvalRequired] = await Promise.all([
    checkIsRegistrationEnabled(c),
    checkIsInviteOnly(c),
    instanceSettingsService.isApprovalRequired(),
  ]);

  return c.json({
    registrationEnabled,
    inviteOnly,
    approvalRequired,
  });
});

/**
 * User Registration
 *
 * POST /api/auth/register
 *
 * Creates a new user account and automatically logs in.
 *
 * @remarks
 * Request Body:
 * ```json
 * {
 *   "username": "alice",
 *   "email": "alice@example.com",
 *   "password": "securePassword123",
 *   "name": "Alice Smith", // optional
 *   "invitationCode": "ABC123" // required if REQUIRE_INVITATION=true
 * }
 * ```
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
 * - 400: Missing or invalid fields
 * - 403: Registration is invite-only or invalid invitation code
 * - 409: Username or email already exists
 */
app.post("/register", rateLimit(RateLimitPresets.register), async (c) => {
  const body = await c.req.json();

  // Check if registration is enabled
  const registrationEnabled = await checkIsRegistrationEnabled(c);
  if (!registrationEnabled) {
    return c.json({ error: "Registration is currently disabled" }, 403);
  }

  // Validation
  if (!body.username || typeof body.username !== "string") {
    return c.json({ error: "Username is required" }, 400);
  }
  if (!body.email || typeof body.email !== "string") {
    return c.json({ error: "Email is required" }, 400);
  }
  if (!body.password || typeof body.password !== "string") {
    return c.json({ error: "Password is required" }, 400);
  }

  // Username validation
  if (body.username.length < 3 || body.username.length > 20) {
    return c.json({ error: "Username must be between 3 and 20 characters" }, 400);
  }
  if (!/^[a-zA-Z0-9_]+$/.test(body.username)) {
    return c.json(
      { error: "Username must contain only alphanumeric characters and underscores" },
      400,
    );
  }

  // Password validation
  if (body.password.length < 8) {
    return c.json({ error: "Password must be at least 8 characters long" }, 400);
  }

  // Email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return c.json({ error: "Invalid email address" }, 400);
  }

  // Check invitation code if invite-only mode is enabled
  const invitationCodeRepo = c.get("invitationCodeRepository");
  const isInviteOnlyMode = await checkIsInviteOnly(c);
  if (isInviteOnlyMode) {
    if (!body.invitationCode || typeof body.invitationCode !== "string") {
      return c.json({ error: "Invitation code is required for registration" }, 403);
    }

    const isValidCode = await invitationCodeRepo.isValid(body.invitationCode);
    if (!isValidCode) {
      return c.json({ error: "Invalid or expired invitation code" }, 403);
    }
  }

  try {
    const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
    const { user, session } = await authService.register({
      username: body.username,
      email: body.email,
      password: body.password,
      name: body.name,
    });

    // Mark invitation code as used (if provided)
    if (body.invitationCode) {
      await invitationCodeRepo.use(body.invitationCode, user.id);
    }

    // Remove sensitive data from response
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
 * Login
 *
 * POST /api/auth/session
 *
 * Logs in with username and password, and issues a session token.
 *
 * @remarks
 * Request Body:
 * ```json
 * {
 *   "username": "alice",
 *   "password": "securePassword123"
 * }
 * ```
 *
 * Response (200):
 * ```json
 * {
 *   "user": { "id": "...", "username": "alice", ... },
 *   "token": "a3f2e1d0c9b8a7f6..."
 * }
 * ```
 *
 * Errors:
 * - 400: Username or password not provided
 * - 401: Invalid username or password
 * - 403: Account is suspended
 */
app.post("/session", rateLimit(RateLimitPresets.login), async (c) => {
  const body = await c.req.json();

  // バリデーション
  if (!body.username || typeof body.username !== "string") {
    return c.json({ error: "Username is required" }, 400);
  }
  if (!body.password || typeof body.password !== "string") {
    return c.json({ error: "Password is required" }, 400);
  }

  try {
    const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
    const { user, session } = await authService.login({
      username: body.username,
      password: body.password,
    });

    // パスワードハッシュとメールアドレスを除外してレスポンス
    const { passwordHash: _passwordHash, email: _email, ...publicUser } = user;

    return c.json({
      user: publicUser,
      token: session.token,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes("Invalid username or password")) {
        return c.json({ error: "Invalid username or password" }, 401);
      }
      if (error.message.includes("suspended")) {
        return c.json({ error: "Account is suspended" }, 403);
      }
    }
    throw error;
  }
});

/**
 * Logout
 *
 * DELETE /api/auth/session
 *
 * Deletes the current session (authentication required).
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
 *   "message": "Logged out successfully"
 * }
 * ```
 *
 * Errors:
 * - 401: Authentication required, or invalid token
 */
app.delete("/session", requireAuth(), async (c) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
  await authService.logout(session.token);

  return c.json({ message: "Logged out successfully" });
});

/**
 * Session Validation
 *
 * GET /api/auth/session
 *
 * Verifies if the current session is valid and returns user and session information (authentication required).
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
 *   "user": { "id": "...", "username": "alice", ... },
 *   "session": {
 *     "id": "...",
 *     "expiresAt": "2025-12-18T15:00:00.000Z",
 *     "lastActivityAt": "2025-11-18T15:00:00.000Z"
 *   }
 * }
 * ```
 *
 * Errors:
 * - 401: Authentication required, or invalid token
 */
app.get("/session", requireAuth(), async (c) => {
  const user = c.get("user");
  const session = c.get("session");

  if (!user || !session) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // パスワードハッシュとメールアドレスを除外
  const { passwordHash: _passwordHash, email: _email, ...publicUser } = user;

  return c.json({
    user: publicUser,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  });
});

// ============================================
// Passkey (WebAuthn) Authentication Routes
// ============================================

/**
 * Helper to create PasskeyService instance
 */
const getPasskeyService = (c: Context): PasskeyService => {
  return new PasskeyService(
    c.get("passkeyCredentialRepository"),
    c.get("passkeyChallengeRepository"),
    c.get("userRepository"),
    c.get("sessionRepository"),
  );
};

/**
 * Begin Passkey Registration
 *
 * POST /api/auth/passkey/register/begin
 *
 * Generates WebAuthn registration options for the authenticated user.
 * Requires authentication - user must be logged in to add a passkey.
 */
app.post("/passkey/register/begin", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const passkeyService = getPasskeyService(c);
    const options = await passkeyService.generateRegistrationOptions(user.id);

    return c.json(options);
  } catch (error) {
    logger.error({ err: error }, "Passkey registration begin error");
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to generate registration options" },
      400,
    );
  }
});

/**
 * Complete Passkey Registration
 *
 * POST /api/auth/passkey/register/finish
 *
 * Verifies and stores the WebAuthn credential after browser registration.
 * Requires authentication.
 */
app.post("/passkey/register/finish", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await c.req.json();

    if (!body.credential) {
      return c.json({ error: "Credential is required" }, 400);
    }

    const passkeyService = getPasskeyService(c);
    const passkey = await passkeyService.verifyRegistration(user.id, body.credential, body.name);

    return c.json({
      success: true,
      passkey: {
        id: passkey.id,
        name: passkey.name,
        createdAt: passkey.createdAt,
        deviceType: passkey.deviceType,
        backedUp: passkey.backedUp,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Passkey registration finish error");
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to verify registration" },
      400,
    );
  }
});

/**
 * Begin Passkey Authentication
 *
 * POST /api/auth/passkey/authenticate/begin
 *
 * Generates WebAuthn authentication options.
 * Can optionally accept a username to filter available credentials.
 */
app.post("/passkey/authenticate/begin", rateLimit(RateLimitPresets.login), async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));

    const passkeyService = getPasskeyService(c);
    const options = await passkeyService.generateAuthenticationOptions(body.username);

    return c.json(options);
  } catch (error) {
    logger.error({ err: error }, "Passkey authentication begin error");
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to generate authentication options" },
      400,
    );
  }
});

/**
 * Complete Passkey Authentication
 *
 * POST /api/auth/passkey/authenticate/finish
 *
 * Verifies the WebAuthn assertion and creates a session.
 * Returns user and token on success.
 */
app.post("/passkey/authenticate/finish", rateLimit(RateLimitPresets.login), async (c) => {
  try {
    const body = await c.req.json();

    if (!body.credential) {
      return c.json({ error: "Credential is required" }, 400);
    }

    const passkeyService = getPasskeyService(c);
    const { user, session } = await passkeyService.verifyAuthentication(body.credential);

    // Remove sensitive data from response
    const { passwordHash: _passwordHash, email: _email, ...publicUser } = user;

    return c.json({
      user: publicUser,
      token: session.token,
    });
  } catch (error) {
    logger.error({ err: error }, "Passkey authentication finish error");
    if (error instanceof Error) {
      if (error.message.includes("suspended")) {
        return c.json({ error: "Account is suspended" }, 403);
      }
    }
    return c.json(
      { error: error instanceof Error ? error.message : "Authentication failed" },
      401,
    );
  }
});

/**
 * List User's Passkeys
 *
 * GET /api/auth/passkey
 *
 * Returns all passkeys registered by the authenticated user.
 */
app.get("/passkey", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const passkeyService = getPasskeyService(c);
    const passkeys = await passkeyService.getUserPasskeys(user.id);

    return c.json({
      passkeys: passkeys.map((p) => ({
        id: p.id,
        name: p.name,
        deviceType: p.deviceType,
        backedUp: p.backedUp,
        createdAt: p.createdAt,
        lastUsedAt: p.lastUsedAt,
      })),
    });
  } catch (error) {
    logger.error({ err: error }, "List passkeys error");
    return c.json({ error: "Failed to list passkeys" }, 500);
  }
});

/**
 * Delete a Passkey
 *
 * DELETE /api/auth/passkey/:id
 *
 * Deletes a specific passkey by ID.
 */
app.delete("/passkey/:id", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const passkeyId = c.req.param("id");
  if (!passkeyId) {
    return c.json({ error: "Passkey ID is required" }, 400);
  }

  try {
    const passkeyService = getPasskeyService(c);
    await passkeyService.deletePasskey(user.id, passkeyId);

    return c.json({ success: true });
  } catch (error) {
    logger.error({ err: error }, "Delete passkey error");
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to delete passkey" },
      400,
    );
  }
});

/**
 * Rename a Passkey
 *
 * PATCH /api/auth/passkey/:id
 *
 * Updates the name of a specific passkey.
 */
app.patch("/passkey/:id", requireAuth(), async (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const passkeyId = c.req.param("id");
  if (!passkeyId) {
    return c.json({ error: "Passkey ID is required" }, 400);
  }

  try {
    const body = await c.req.json();

    if (!body.name || typeof body.name !== "string") {
      return c.json({ error: "Name is required" }, 400);
    }

    const passkeyService = getPasskeyService(c);
    const passkey = await passkeyService.renamePasskey(user.id, passkeyId, body.name);

    return c.json({
      passkey: {
        id: passkey.id,
        name: passkey.name,
        deviceType: passkey.deviceType,
        backedUp: passkey.backedUp,
        createdAt: passkey.createdAt,
        lastUsedAt: passkey.lastUsedAt,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Rename passkey error");
    return c.json(
      { error: error instanceof Error ? error.message : "Failed to rename passkey" },
      400,
    );
  }
});

export default app;
