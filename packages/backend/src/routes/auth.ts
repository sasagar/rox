/**
 * Authentication API Routes
 *
 * Provides endpoints for login, logout, and session validation.
 *
 * @module routes/auth
 */

import { Hono } from 'hono';
import { AuthService } from '../services/AuthService.js';
import { requireAuth } from '../middleware/auth.js';
import { rateLimit, RateLimitPresets } from '../middleware/rateLimit.js';
import type { Context } from 'hono';

const app = new Hono();

/**
 * Check if registration requires an invitation code
 * Uses DB setting first, falls back to environment variable
 */
const checkIsInviteOnly = async (c: Context): Promise<boolean> => {
  // First check DB setting
  const instanceSettingsService = c.get('instanceSettingsService');
  const dbSetting = await instanceSettingsService.isInviteOnly();

  // If DB says invite-only, use that
  if (dbSetting) return true;

  // Fall back to environment variable for backwards compatibility
  const requireInvitation = process.env.REQUIRE_INVITATION;
  return requireInvitation === 'true' || requireInvitation === '1';
};

/**
 * Check if registration is enabled
 * Uses DB setting first, falls back to environment variable
 */
const checkIsRegistrationEnabled = async (c: Context): Promise<boolean> => {
  const instanceSettingsService = c.get('instanceSettingsService');
  const dbSetting = await instanceSettingsService.isRegistrationEnabled();

  // If DB setting exists and is false, registration is disabled
  // Fall back to env var ENABLE_REGISTRATION if DB doesn't have a setting
  if (!dbSetting) {
    const envSetting = process.env.ENABLE_REGISTRATION;
    // If env var is explicitly 'false' or '0', registration is disabled
    if (envSetting === 'false' || envSetting === '0') return false;
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
app.get('/register/settings', async (c) => {
  const instanceSettingsService = c.get('instanceSettingsService');

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
app.post('/register', rateLimit(RateLimitPresets.register), async (c) => {
  const body = await c.req.json();

  // Check if registration is enabled
  const registrationEnabled = await checkIsRegistrationEnabled(c);
  if (!registrationEnabled) {
    return c.json({ error: 'Registration is currently disabled' }, 403);
  }

  // Validation
  if (!body.username || typeof body.username !== 'string') {
    return c.json({ error: 'Username is required' }, 400);
  }
  if (!body.email || typeof body.email !== 'string') {
    return c.json({ error: 'Email is required' }, 400);
  }
  if (!body.password || typeof body.password !== 'string') {
    return c.json({ error: 'Password is required' }, 400);
  }

  // Username validation
  if (body.username.length < 3 || body.username.length > 20) {
    return c.json({ error: 'Username must be between 3 and 20 characters' }, 400);
  }
  if (!/^[a-zA-Z0-9_]+$/.test(body.username)) {
    return c.json({ error: 'Username must contain only alphanumeric characters and underscores' }, 400);
  }

  // Password validation
  if (body.password.length < 8) {
    return c.json({ error: 'Password must be at least 8 characters long' }, 400);
  }

  // Email validation
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
    return c.json({ error: 'Invalid email address' }, 400);
  }

  // Check invitation code if invite-only mode is enabled
  const invitationCodeRepo = c.get('invitationCodeRepository');
  const isInviteOnlyMode = await checkIsInviteOnly(c);
  if (isInviteOnlyMode) {
    if (!body.invitationCode || typeof body.invitationCode !== 'string') {
      return c.json({ error: 'Invitation code is required for registration' }, 403);
    }

    const isValidCode = await invitationCodeRepo.isValid(body.invitationCode);
    if (!isValidCode) {
      return c.json({ error: 'Invalid or expired invitation code' }, 403);
    }
  }

  try {
    const authService = new AuthService(c.get('userRepository'), c.get('sessionRepository'));
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
      201
    );
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
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
app.post('/session', rateLimit(RateLimitPresets.login), async (c) => {
  const body = await c.req.json();

  // バリデーション
  if (!body.username || typeof body.username !== 'string') {
    return c.json({ error: 'Username is required' }, 400);
  }
  if (!body.password || typeof body.password !== 'string') {
    return c.json({ error: 'Password is required' }, 400);
  }

  try {
    const authService = new AuthService(c.get('userRepository'), c.get('sessionRepository'));
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
      if (error.message.includes('Invalid username or password')) {
        return c.json({ error: 'Invalid username or password' }, 401);
      }
      if (error.message.includes('suspended')) {
        return c.json({ error: 'Account is suspended' }, 403);
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
app.delete('/session', requireAuth(), async (c) => {
  const session = c.get('session');
  if (!session) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const authService = new AuthService(c.get('userRepository'), c.get('sessionRepository'));
  await authService.logout(session.token);

  return c.json({ message: 'Logged out successfully' });
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
app.get('/session', requireAuth(), async (c) => {
  const user = c.get('user');
  const session = c.get('session');

  if (!user || !session) {
    return c.json({ error: 'Unauthorized' }, 401);
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

export default app;
