/**
 * Authentication Middleware
 *
 * Provides authentication middleware for Hono applications.
 * Supports session-based authentication using Bearer tokens.
 *
 * @module middleware/auth
 */

import type { Context, Next } from 'hono';
import type { User, Session } from 'shared';
import { AuthService } from '../services/AuthService.js';

declare module 'hono' {
  interface ContextVariableMap {
    /** Currently authenticated user (only when authenticated) */
    user?: User;
    /** Current session (only when authenticated) */
    session?: Session;
  }
}

/**
 * Optional Authentication Middleware
 *
 * Validates the Authorization header if present, but does not return an error if absent.
 * Sets user and session in the context when authentication is successful.
 *
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * app.get('/api/notes', optionalAuth(), async (c) => {
 *   const user = c.get('user'); // User object if authenticated, undefined otherwise
 *   // Display public notes, and private notes if logged in
 * });
 * ```
 *
 * @remarks
 * - Authorization header format: `Bearer <token>`
 * - Proceeds to the next handler even if authentication fails
 * - Use for public endpoints that provide additional features to logged-in users
 */
export function optionalAuth() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      await next();
      return;
    }

    // Bearer トークンを抽出
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      await next();
      return;
    }

    // セッション検証
    const authService = new AuthService(c.get('userRepository'), c.get('sessionRepository'));
    const result = await authService.validateSession(token);

    if (result) {
      c.set('user', result.user);
      c.set('session', result.session);
    }

    await next();
  };
}

/**
 * Required Authentication Middleware
 *
 * Returns a 401 error if a valid Authorization header is not present.
 * Sets user and session in the context when authentication is successful.
 *
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * app.post('/api/notes', requireAuth(), async (c) => {
 *   const user = c.get('user')!; // Guaranteed to exist
 *   // Create note
 * });
 * ```
 *
 * @remarks
 * - Authorization header format: `Bearer <token>`
 * - No token: `401 Authentication required`
 * - Invalid token format: `401 Invalid token format`
 * - Invalid or expired token: `401 Invalid or expired token`
 * - Use for endpoints that require authentication
 */
export function requireAuth() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    // Bearer トークンを抽出
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) {
      return c.json({ error: 'Invalid token format' }, 401);
    }

    // セッション検証
    const authService = new AuthService(c.get('userRepository'), c.get('sessionRepository'));
    const result = await authService.validateSession(token);

    if (!result) {
      return c.json({ error: 'Invalid or expired token' }, 401);
    }

    c.set('user', result.user);
    c.set('session', result.session);

    return await next();
  };
}
