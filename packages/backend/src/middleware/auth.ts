/**
 * Authentication Middleware
 *
 * Provides authentication middleware for Hono applications.
 * Supports session-based authentication using Bearer tokens.
 *
 * @module middleware/auth
 */

import type { Context, Next } from "hono";
import type { User, Session } from "shared";
import { AuthService } from "../services/AuthService.js";
import type { RolePolicies } from "../db/schema/pg.js";
import { logger } from "../lib/logger.js";

declare module "hono" {
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
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      await next();
      return;
    }

    // Bearer トークンを抽出
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      await next();
      return;
    }

    // セッション検証
    const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
    const result = await authService.validateSession(token);

    if (result) {
      c.set("user", result.user);
      c.set("session", result.session);
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
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Authentication required" }, 401);
    }

    // Bearer トークンを抽出
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return c.json({ error: "Invalid token format" }, 401);
    }

    // セッション検証
    const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
    const result = await authService.validateSession(token);

    if (!result) {
      // Debug log for troubleshooting authentication issues
      logger.debug(
        { tokenPrefix: token.substring(0, 8), path: c.req.path },
        "Token validation failed",
      );
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    // Check if user is suspended
    if (result.user.isSuspended) {
      return c.json({ error: "Your account has been suspended" }, 403);
    }

    c.set("user", result.user);
    c.set("session", result.session);

    return await next();
  };
}

/**
 * Admin-only Authentication Middleware
 *
 * Requires the user to be authenticated AND have admin privileges.
 * Returns 401 if not authenticated, 403 if not an admin.
 *
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * app.post('/api/admin/users/suspend', requireAdmin(), async (c) => {
 *   const admin = c.get('user')!; // Guaranteed to be admin
 *   // Suspend user
 * });
 * ```
 *
 * @remarks
 * - Chains authentication check with admin role verification
 * - Not authenticated: `401 Authentication required`
 * - Authenticated but not admin: `403 Admin access required`
 * - Use for administrative endpoints
 */
export function requireAdmin() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return c.json({ error: "Invalid token format" }, 401);
    }

    const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
    const result = await authService.validateSession(token);

    if (!result) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    // Check if user is suspended
    if (result.user.isSuspended) {
      return c.json({ error: "Your account has been suspended" }, 403);
    }

    // Check if user is admin
    if (!result.user.isAdmin) {
      return c.json({ error: "Admin access required" }, 403);
    }

    c.set("user", result.user);
    c.set("session", result.session);

    return await next();
  };
}

/**
 * Permission-based Authorization Middleware
 *
 * Requires the user to be authenticated AND have a specific permission.
 * Uses the role-based permission system to check if the user has the required permission.
 *
 * @param permission - The permission to check (key of RolePolicies)
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * app.post('/api/invitations/create', requirePermission('canInvite'), async (c) => {
 *   const user = c.get('user')!; // Guaranteed to have canInvite permission
 *   // Create invitation
 * });
 * ```
 *
 * @remarks
 * - Chains authentication check with role-based permission verification
 * - Not authenticated: `401 Authentication required`
 * - Authenticated but lacks permission: `403 Permission denied`
 * - Use for endpoints that require specific permissions
 */
export function requirePermission(permission: keyof RolePolicies) {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return c.json({ error: "Invalid token format" }, 401);
    }

    const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
    const result = await authService.validateSession(token);

    if (!result) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    // Check if user is suspended
    if (result.user.isSuspended) {
      return c.json({ error: "Your account has been suspended" }, 403);
    }

    c.set("user", result.user);
    c.set("session", result.session);

    // Check role-based permission
    const roleService = c.get("roleService");
    const hasPermission = await roleService.hasPermission(result.user.id, permission);

    if (!hasPermission) {
      // Fallback to legacy isAdmin check for admin permissions
      if (
        result.user.isAdmin &&
        [
          "canManageRoles",
          "canManageInstanceSettings",
          "canManageInstanceBlocks",
          "canManageUsers",
          "canManageReports",
          "canDeleteNotes",
          "canSuspendUsers",
          "canInvite",
          "canManageCustomEmojis",
        ].includes(permission)
      ) {
        return await next();
      }
      return c.json({ error: "Permission denied" }, 403);
    }

    return await next();
  };
}

/**
 * Role-based Admin Authorization Middleware
 *
 * Requires the user to be authenticated AND have admin role (via role system).
 * This is the modern replacement for requireAdmin() that uses the role system.
 *
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * app.post('/api/admin/roles/create', requireAdminRole(), async (c) => {
 *   const admin = c.get('user')!; // Guaranteed to have admin role
 *   // Create role
 * });
 * ```
 *
 * @remarks
 * - Uses role-based system instead of user.isAdmin flag
 * - Falls back to user.isAdmin for backwards compatibility
 */
export function requireAdminRole() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return c.json({ error: "Invalid token format" }, 401);
    }

    const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
    const result = await authService.validateSession(token);

    if (!result) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    // Check if user is suspended
    if (result.user.isSuspended) {
      return c.json({ error: "Your account has been suspended" }, 403);
    }

    c.set("user", result.user);
    c.set("session", result.session);

    // Check role-based admin status
    const roleService = c.get("roleService");
    const isAdmin = await roleService.isAdmin(result.user.id);

    // Fallback to legacy isAdmin flag
    if (!isAdmin && !result.user.isAdmin) {
      return c.json({ error: "Admin access required" }, 403);
    }

    return await next();
  };
}

/**
 * Role-based Moderator Authorization Middleware
 *
 * Requires the user to be authenticated AND have moderator role (via role system).
 *
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * app.post('/api/mod/reports/resolve', requireModeratorRole(), async (c) => {
 *   const mod = c.get('user')!; // Guaranteed to have moderator role
 *   // Resolve report
 * });
 * ```
 *
 * @remarks
 * - Uses role-based system
 * - Admins automatically pass this check
 */
export function requireModeratorRole() {
  return async (c: Context, next: Next) => {
    const authHeader = c.req.header("Authorization");
    if (!authHeader) {
      return c.json({ error: "Authentication required" }, 401);
    }

    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return c.json({ error: "Invalid token format" }, 401);
    }

    const authService = new AuthService(c.get("userRepository"), c.get("sessionRepository"));
    const result = await authService.validateSession(token);

    if (!result) {
      return c.json({ error: "Invalid or expired token" }, 401);
    }

    // Check if user is suspended
    if (result.user.isSuspended) {
      return c.json({ error: "Your account has been suspended" }, 403);
    }

    c.set("user", result.user);
    c.set("session", result.session);

    // Check role-based moderator/admin status
    const roleService = c.get("roleService");
    const isModerator = await roleService.isModerator(result.user.id);
    const isAdmin = await roleService.isAdmin(result.user.id);

    // Admins automatically pass, or fallback to legacy isAdmin flag
    if (!isModerator && !isAdmin && !result.user.isAdmin) {
      return c.json({ error: "Moderator access required" }, 403);
    }

    return await next();
  };
}
