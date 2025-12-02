/**
 * Admin API Routes
 *
 * Provides administrative endpoints for managing users and instance blocks.
 * All endpoints require admin authentication.
 *
 * @module routes/admin
 */

import { Hono } from "hono";
import { requireAdmin } from "../middleware/auth.js";
import {
  sanitizeUser,
  parsePagination,
  normalizeHostname,
  errorResponse,
} from "../lib/routeUtils.js";

const app = new Hono();

// All admin routes require admin authentication
app.use("/*", requireAdmin());

// ============================================================================
// User Management Endpoints
// ============================================================================

/**
 * List Users
 *
 * GET /api/admin/users
 *
 * Returns a paginated list of users with optional filters.
 *
 * Query Parameters:
 * - limit: Maximum number of users (default: 100, max: 1000)
 * - offset: Number of users to skip (default: 0)
 * - localOnly: Filter to local users only (default: false)
 * - isAdmin: Filter by admin status (optional)
 * - isSuspended: Filter by suspended status (optional)
 *
 * Response (200):
 * ```json
 * {
 *   "users": [...],
 *   "total": 150
 * }
 * ```
 */
app.get("/users", async (c) => {
  const userRepository = c.get("userRepository");

  const { limit, offset } = parsePagination(c);
  const localOnly = c.req.query("localOnly") === "true";
  const isAdmin =
    c.req.query("isAdmin") !== undefined ? c.req.query("isAdmin") === "true" : undefined;
  const isSuspended =
    c.req.query("isSuspended") !== undefined ? c.req.query("isSuspended") === "true" : undefined;

  const users = await userRepository.findAll({
    limit,
    offset,
    localOnly,
    isAdmin,
    isSuspended,
  });

  const total = await userRepository.count(localOnly);

  // Remove sensitive data
  const sanitizedUsers = users.map((user: any) => sanitizeUser(user));

  return c.json({ users: sanitizedUsers, total });
});

/**
 * Get User Details
 *
 * GET /api/admin/users/:id
 *
 * Returns detailed information about a specific user including admin fields.
 */
app.get("/users/:id", async (c) => {
  const userRepository = c.get("userRepository");
  const userId = c.req.param("id");

  const user = await userRepository.findById(userId);
  if (!user) {
    return errorResponse(c, "User not found", 404);
  }

  // Remove password hash but keep other admin-relevant info
  return c.json(sanitizeUser(user));
});

/**
 * Update User Admin Status
 *
 * POST /api/admin/users/:id/admin
 *
 * Grants or revokes admin privileges for a user.
 *
 * Request Body:
 * ```json
 * {
 *   "isAdmin": true
 * }
 * ```
 */
app.post("/users/:id/admin", async (c) => {
  const userRepository = c.get("userRepository");
  const currentAdmin = c.get("user");
  const userId = c.req.param("id");

  // Prevent self-demotion
  if (userId === currentAdmin?.id) {
    return errorResponse(c, "Cannot change your own admin status");
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    return errorResponse(c, "User not found", 404);
  }

  // Cannot modify remote users
  if (user.host !== null) {
    return errorResponse(c, "Cannot modify remote user admin status");
  }

  const body = await c.req.json();
  if (typeof body.isAdmin !== "boolean") {
    return errorResponse(c, "isAdmin must be a boolean");
  }

  const updatedUser = await userRepository.update(userId, { isAdmin: body.isAdmin });

  return c.json(sanitizeUser(updatedUser));
});

/**
 * Suspend User
 *
 * POST /api/admin/users/:id/suspend
 *
 * Suspends a user, preventing them from logging in or performing actions.
 *
 * Request Body:
 * ```json
 * {
 *   "isSuspended": true
 * }
 * ```
 */
app.post("/users/:id/suspend", async (c) => {
  const userRepository = c.get("userRepository");
  const currentAdmin = c.get("user");
  const userId = c.req.param("id");

  // Prevent self-suspension
  if (userId === currentAdmin?.id) {
    return errorResponse(c, "Cannot suspend yourself");
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    return errorResponse(c, "User not found", 404);
  }

  // Cannot suspend other admins
  if (user.isAdmin) {
    return errorResponse(c, "Cannot suspend an admin user. Remove admin status first.");
  }

  const body = await c.req.json();
  if (typeof body.isSuspended !== "boolean") {
    return errorResponse(c, "isSuspended must be a boolean");
  }

  const updatedUser = await userRepository.update(userId, { isSuspended: body.isSuspended });

  return c.json(sanitizeUser(updatedUser));
});

/**
 * Delete User
 *
 * DELETE /api/admin/users/:id
 *
 * Permanently deletes a user and all associated data.
 * Use with caution - this cannot be undone.
 */
app.delete("/users/:id", async (c) => {
  const userRepository = c.get("userRepository");
  const currentAdmin = c.get("user");
  const userId = c.req.param("id");

  // Prevent self-deletion
  if (userId === currentAdmin?.id) {
    return errorResponse(c, "Cannot delete yourself");
  }

  const user = await userRepository.findById(userId);
  if (!user) {
    return errorResponse(c, "User not found", 404);
  }

  // Cannot delete other admins
  if (user.isAdmin) {
    return errorResponse(c, "Cannot delete an admin user. Remove admin status first.");
  }

  await userRepository.delete(userId);

  return c.json({ success: true, message: `User ${user.username} has been deleted` });
});

// ============================================================================
// Instance Block Management Endpoints
// ============================================================================

/**
 * List Blocked Instances
 *
 * GET /api/admin/instance-blocks
 *
 * Returns a paginated list of blocked instances.
 *
 * Query Parameters:
 * - limit: Maximum number of blocks (default: 100)
 * - offset: Number of blocks to skip (default: 0)
 */
app.get("/instance-blocks", async (c) => {
  const instanceBlockRepository = c.get("instanceBlockRepository");

  const { limit, offset } = parsePagination(c);

  const blocks = await instanceBlockRepository.findAll(limit, offset);
  const total = await instanceBlockRepository.count();

  return c.json({ blocks, total });
});

/**
 * Check if Instance is Blocked
 *
 * GET /api/admin/instance-blocks/check
 *
 * Checks if a specific instance host is blocked.
 *
 * Query Parameters:
 * - host: Instance hostname to check
 */
app.get("/instance-blocks/check", async (c) => {
  const instanceBlockRepository = c.get("instanceBlockRepository");
  const host = c.req.query("host");

  if (!host) {
    return errorResponse(c, "host parameter is required");
  }

  const isBlocked = await instanceBlockRepository.isBlocked(host);
  const block = isBlocked ? await instanceBlockRepository.findByHost(host) : null;

  return c.json({ host, isBlocked, block });
});

/**
 * Block an Instance
 *
 * POST /api/admin/instance-blocks
 *
 * Adds a new instance to the block list.
 *
 * Request Body:
 * ```json
 * {
 *   "host": "spam.instance.com",
 *   "reason": "Spam and harassment"
 * }
 * ```
 */
app.post("/instance-blocks", async (c) => {
  const instanceBlockRepository = c.get("instanceBlockRepository");
  const admin = c.get("user");

  const body = await c.req.json();

  if (!body.host || typeof body.host !== "string") {
    return errorResponse(c, "host is required");
  }

  // Normalize hostname (lowercase, no protocol)
  const host = normalizeHostname(body.host);

  // Check if already blocked
  const existing = await instanceBlockRepository.findByHost(host);
  if (existing) {
    return errorResponse(c, `Instance ${host} is already blocked`, 409);
  }

  const block = await instanceBlockRepository.create({
    host,
    reason: body.reason || null,
    blockedById: admin!.id,
  });

  return c.json(block, 201);
});

/**
 * Unblock an Instance
 *
 * DELETE /api/admin/instance-blocks/:host
 *
 * Removes an instance from the block list.
 */
app.delete("/instance-blocks/:host", async (c) => {
  const instanceBlockRepository = c.get("instanceBlockRepository");
  const host = c.req.param("host");

  const deleted = await instanceBlockRepository.deleteByHost(host);
  if (!deleted) {
    return errorResponse(c, `Instance ${host} is not blocked`, 404);
  }

  return c.json({ success: true, message: `Instance ${host} has been unblocked` });
});

// ============================================================================
// Invitation Code Management Endpoints
// ============================================================================

/**
 * Generate a random invitation code
 */
const generateInvitationCode = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing characters
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

/**
 * List Invitation Codes
 *
 * GET /api/admin/invitations
 *
 * Returns a paginated list of invitation codes.
 */
app.get("/invitations", async (c) => {
  const invitationCodeRepository = c.get("invitationCodeRepository");

  const { limit, offset } = parsePagination(c);

  const codes = await invitationCodeRepository.findAll(limit, offset);
  const total = await invitationCodeRepository.count();
  const unused = await invitationCodeRepository.countUnused();

  return c.json({ codes, total, unused });
});

/**
 * Create Invitation Code
 *
 * POST /api/admin/invitations
 *
 * Creates a new invitation code.
 *
 * Request Body:
 * ```json
 * {
 *   "code": "CUSTOM123", // optional, auto-generated if not provided
 *   "expiresAt": "2025-12-31T23:59:59Z", // optional
 *   "maxUses": 1 // optional, default 1
 * }
 * ```
 */
app.post("/invitations", async (c) => {
  const invitationCodeRepository = c.get("invitationCodeRepository");
  const admin = c.get("user");

  const body = await c.req.json().catch(() => ({}));

  const code = body.code?.toUpperCase() || generateInvitationCode();

  // Check if code already exists
  const existing = await invitationCodeRepository.findByCode(code);
  if (existing) {
    return errorResponse(c, "Invitation code already exists", 409);
  }

  const invitation = await invitationCodeRepository.create({
    code,
    createdById: admin!.id,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    maxUses: body.maxUses || 1,
  });

  return c.json(invitation, 201);
});

/**
 * Delete Invitation Code
 *
 * DELETE /api/admin/invitations/:id
 *
 * Deletes an invitation code.
 */
app.delete("/invitations/:id", async (c) => {
  const invitationCodeRepository = c.get("invitationCodeRepository");
  const id = c.req.param("id");

  const deleted = await invitationCodeRepository.delete(id);
  if (!deleted) {
    return errorResponse(c, "Invitation code not found", 404);
  }

  return c.json({ success: true, message: "Invitation code deleted" });
});

// ============================================================================
// User Report Management Endpoints
// ============================================================================

/**
 * List Reports
 *
 * GET /api/admin/reports
 *
 * Returns a paginated list of user reports.
 *
 * Query Parameters:
 * - status: Filter by status (pending, resolved, rejected)
 * - limit: Maximum number of reports (default: 100)
 * - offset: Number of reports to skip (default: 0)
 */
app.get("/reports", async (c) => {
  const userReportRepository = c.get("userReportRepository");

  const { limit, offset } = parsePagination(c);
  const status = c.req.query("status") as "pending" | "resolved" | "rejected" | undefined;

  const reports = await userReportRepository.findAll({ status, limit, offset });
  const total = await userReportRepository.count({ status });
  const pendingCount = await userReportRepository.count({ status: "pending" });

  return c.json({ reports, total, pendingCount });
});

/**
 * Get Report Details
 *
 * GET /api/admin/reports/:id
 *
 * Returns detailed information about a specific report.
 */
app.get("/reports/:id", async (c) => {
  const userReportRepository = c.get("userReportRepository");
  const userRepository = c.get("userRepository");
  const noteRepository = c.get("noteRepository");
  const id = c.req.param("id");

  const report = await userReportRepository.findById(id);
  if (!report) {
    return errorResponse(c, "Report not found", 404);
  }

  // Fetch related data
  const [reporter, targetUser, targetNote] = await Promise.all([
    userRepository.findById(report.reporterId),
    report.targetUserId ? userRepository.findById(report.targetUserId) : null,
    report.targetNoteId ? noteRepository.findById(report.targetNoteId) : null,
  ]);

  return c.json({
    ...report,
    reporter: reporter ? { id: reporter.id, username: reporter.username } : null,
    targetUser: targetUser
      ? { id: targetUser.id, username: targetUser.username, host: targetUser.host }
      : null,
    targetNote: targetNote ? { id: targetNote.id, text: targetNote.text } : null,
  });
});

/**
 * Resolve Report
 *
 * POST /api/admin/reports/:id/resolve
 *
 * Resolves or rejects a report.
 *
 * Request Body:
 * ```json
 * {
 *   "status": "resolved", // or "rejected"
 *   "resolution": "User has been warned"
 * }
 * ```
 */
app.post("/reports/:id/resolve", async (c) => {
  const userReportRepository = c.get("userReportRepository");
  const admin = c.get("user");
  const id = c.req.param("id");

  const body = await c.req.json();

  if (!["resolved", "rejected"].includes(body.status)) {
    return errorResponse(c, 'status must be "resolved" or "rejected"');
  }

  const report = await userReportRepository.findById(id);
  if (!report) {
    return errorResponse(c, "Report not found", 404);
  }

  if (report.status !== "pending") {
    return errorResponse(c, "Report has already been processed");
  }

  const updated = await userReportRepository.resolve(
    id,
    admin!.id,
    body.resolution || "",
    body.status,
  );

  return c.json(updated);
});

/**
 * Delete Note (Moderation)
 *
 * DELETE /api/admin/notes/:id
 *
 * Deletes a note as a moderation action.
 */
app.delete("/notes/:id", async (c) => {
  const noteRepository = c.get("noteRepository");
  const id = c.req.param("id");

  const note = await noteRepository.findById(id);
  if (!note) {
    return errorResponse(c, "Note not found", 404);
  }

  await noteRepository.delete(id);

  return c.json({ success: true, message: "Note deleted" });
});

// ============================================================================
// Role Management Endpoints
// ============================================================================

/**
 * List Roles
 *
 * GET /api/admin/roles
 *
 * Returns all roles.
 */
app.get("/roles", async (c) => {
  const roleRepository = c.get("roleRepository");

  const { limit, offset } = parsePagination(c);

  const roles = await roleRepository.findAll(limit, offset);
  const total = await roleRepository.count();

  return c.json({ roles, total });
});

/**
 * Get Role Details
 *
 * GET /api/admin/roles/:id
 */
app.get("/roles/:id", async (c) => {
  const roleRepository = c.get("roleRepository");
  const id = c.req.param("id");

  const role = await roleRepository.findById(id);
  if (!role) {
    return errorResponse(c, "Role not found", 404);
  }

  return c.json(role);
});

/**
 * Create Role
 *
 * POST /api/admin/roles
 *
 * Request Body:
 * ```json
 * {
 *   "name": "Inviter",
 *   "description": "Can invite new users",
 *   "color": "#3498db",
 *   "policies": {
 *     "canInvite": true,
 *     "inviteLimit": 10
 *   }
 * }
 * ```
 */
app.post("/roles", async (c) => {
  const roleRepository = c.get("roleRepository");

  const body = await c.req.json();

  if (!body.name || typeof body.name !== "string") {
    return errorResponse(c, "name is required");
  }

  // Check if name already exists
  const existing = await roleRepository.findByName(body.name);
  if (existing) {
    return errorResponse(c, "Role with this name already exists", 409);
  }

  const role = await roleRepository.create({
    name: body.name,
    description: body.description,
    color: body.color,
    iconUrl: body.iconUrl,
    displayOrder: body.displayOrder,
    isPublic: body.isPublic ?? false,
    isDefault: body.isDefault ?? false,
    isAdminRole: body.isAdminRole ?? false,
    isModeratorRole: body.isModeratorRole ?? false,
    policies: body.policies ?? {},
  });

  return c.json(role, 201);
});

/**
 * Update Role
 *
 * PATCH /api/admin/roles/:id
 */
app.patch("/roles/:id", async (c) => {
  const roleRepository = c.get("roleRepository");
  const id = c.req.param("id");

  const role = await roleRepository.findById(id);
  if (!role) {
    return errorResponse(c, "Role not found", 404);
  }

  const body = await c.req.json();

  // Check name uniqueness if changing name
  if (body.name && body.name !== role.name) {
    const existing = await roleRepository.findByName(body.name);
    if (existing) {
      return errorResponse(c, "Role with this name already exists", 409);
    }
  }

  const updated = await roleRepository.update(id, {
    name: body.name,
    description: body.description,
    color: body.color,
    iconUrl: body.iconUrl,
    displayOrder: body.displayOrder,
    isPublic: body.isPublic,
    isDefault: body.isDefault,
    isAdminRole: body.isAdminRole,
    isModeratorRole: body.isModeratorRole,
    policies: body.policies,
  });

  return c.json(updated);
});

/**
 * Delete Role
 *
 * DELETE /api/admin/roles/:id
 */
app.delete("/roles/:id", async (c) => {
  const roleRepository = c.get("roleRepository");
  const id = c.req.param("id");

  const role = await roleRepository.findById(id);
  if (!role) {
    return errorResponse(c, "Role not found", 404);
  }

  // Don't allow deleting built-in roles
  if (role.name === "Admin" || role.name === "Moderator") {
    return errorResponse(c, "Cannot delete built-in roles");
  }

  await roleRepository.delete(id);

  return c.json({ success: true, message: `Role "${role.name}" deleted` });
});

/**
 * Assign Role to User
 *
 * POST /api/admin/roles/:roleId/assign
 *
 * Request Body:
 * ```json
 * {
 *   "userId": "user123",
 *   "expiresAt": "2025-12-31T23:59:59Z" // optional
 * }
 * ```
 */
app.post("/roles/:roleId/assign", async (c) => {
  const roleRepository = c.get("roleRepository");
  const roleService = c.get("roleService");
  const admin = c.get("user");
  const roleId = c.req.param("roleId");

  const role = await roleRepository.findById(roleId);
  if (!role) {
    return errorResponse(c, "Role not found", 404);
  }

  const body = await c.req.json();
  if (!body.userId) {
    return errorResponse(c, "userId is required");
  }

  const expiresAt = body.expiresAt ? new Date(body.expiresAt) : undefined;

  await roleService.assignRole(body.userId, roleId, admin?.id, expiresAt);

  return c.json({ success: true, message: `Role "${role.name}" assigned to user` });
});

/**
 * Unassign Role from User
 *
 * POST /api/admin/roles/:roleId/unassign
 *
 * Request Body:
 * ```json
 * {
 *   "userId": "user123"
 * }
 * ```
 */
app.post("/roles/:roleId/unassign", async (c) => {
  const roleRepository = c.get("roleRepository");
  const roleService = c.get("roleService");
  const roleId = c.req.param("roleId");

  const role = await roleRepository.findById(roleId);
  if (!role) {
    return errorResponse(c, "Role not found", 404);
  }

  const body = await c.req.json();
  if (!body.userId) {
    return errorResponse(c, "userId is required");
  }

  const removed = await roleService.unassignRole(body.userId, roleId);
  if (!removed) {
    return errorResponse(c, "User does not have this role", 404);
  }

  return c.json({ success: true, message: `Role "${role.name}" removed from user` });
});

/**
 * Get User's Roles
 *
 * GET /api/admin/users/:userId/roles
 */
app.get("/users/:userId/roles", async (c) => {
  const userRepository = c.get("userRepository");
  const roleService = c.get("roleService");
  const userId = c.req.param("userId");

  const user = await userRepository.findById(userId);
  if (!user) {
    return errorResponse(c, "User not found", 404);
  }

  const roles = await roleService.getUserRoles(userId);
  const policies = await roleService.getEffectivePolicies(userId);

  return c.json({ roles, effectivePolicies: policies });
});

// ============================================================================
// Instance Settings Endpoints
// ============================================================================

/**
 * Get Instance Settings
 *
 * GET /api/admin/settings
 *
 * Returns all instance settings.
 */
app.get("/settings", async (c) => {
  const instanceSettingsService = c.get("instanceSettingsService");

  const [registration, metadata, theme] = await Promise.all([
    instanceSettingsService.getRegistrationSettings(),
    instanceSettingsService.getInstanceMetadata(),
    instanceSettingsService.getThemeSettings(),
  ]);

  return c.json({
    registration,
    instance: metadata,
    theme,
  });
});

/**
 * Update Registration Settings
 *
 * PATCH /api/admin/settings/registration
 *
 * Request Body:
 * ```json
 * {
 *   "enabled": true,
 *   "inviteOnly": false,
 *   "approvalRequired": false
 * }
 * ```
 */
app.patch("/settings/registration", async (c) => {
  const instanceSettingsService = c.get("instanceSettingsService");
  const admin = c.get("user");

  const body = await c.req.json();

  await instanceSettingsService.updateRegistrationSettings(
    {
      enabled: body.enabled,
      inviteOnly: body.inviteOnly,
      approvalRequired: body.approvalRequired,
    },
    admin?.id,
  );

  const settings = await instanceSettingsService.getRegistrationSettings();
  return c.json(settings);
});

/**
 * Update Instance Metadata
 *
 * PATCH /api/admin/settings/instance
 *
 * Request Body:
 * ```json
 * {
 *   "name": "My Instance",
 *   "description": "A cool ActivityPub server",
 *   "maintainerEmail": "admin@example.com"
 * }
 * ```
 */
app.patch("/settings/instance", async (c) => {
  const instanceSettingsService = c.get("instanceSettingsService");
  const admin = c.get("user");

  const body = await c.req.json();

  await instanceSettingsService.updateInstanceMetadata(
    {
      name: body.name,
      description: body.description,
      maintainerEmail: body.maintainerEmail,
      iconUrl: body.iconUrl,
      bannerUrl: body.bannerUrl,
      tosUrl: body.tosUrl,
      privacyPolicyUrl: body.privacyPolicyUrl,
    },
    admin?.id,
  );

  const metadata = await instanceSettingsService.getInstanceMetadata();
  return c.json(metadata);
});

/**
 * Update Theme Settings
 *
 * PATCH /api/admin/settings/theme
 *
 * Request Body:
 * ```json
 * {
 *   "primaryColor": "#3b82f6",
 *   "darkMode": "system"
 * }
 * ```
 */
app.patch("/settings/theme", async (c) => {
  const instanceSettingsService = c.get("instanceSettingsService");
  const admin = c.get("user");

  const body = await c.req.json();

  // Validate primaryColor is a valid hex color
  if (body.primaryColor !== undefined) {
    const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
    if (!hexColorRegex.test(body.primaryColor)) {
      return c.json({ error: "primaryColor must be a valid hex color (e.g., #3b82f6)" }, 400);
    }
  }

  // Validate darkMode
  if (body.darkMode !== undefined) {
    if (!["light", "dark", "system"].includes(body.darkMode)) {
      return c.json({ error: 'darkMode must be "light", "dark", or "system"' }, 400);
    }
  }

  await instanceSettingsService.updateThemeSettings(
    {
      primaryColor: body.primaryColor,
      darkMode: body.darkMode,
    },
    admin?.id,
  );

  const theme = await instanceSettingsService.getThemeSettings();
  return c.json(theme);
});

// ============================================================================
// Instance Statistics
// ============================================================================

/**
 * Get Instance Statistics
 *
 * GET /api/admin/stats
 *
 * Returns various statistics about the instance.
 */
app.get("/stats", async (c) => {
  const userRepository = c.get("userRepository");
  const noteRepository = c.get("noteRepository");
  const instanceBlockRepository = c.get("instanceBlockRepository");
  const invitationCodeRepository = c.get("invitationCodeRepository");
  const userReportRepository = c.get("userReportRepository");

  const [
    totalUsers,
    localUsers,
    totalNotes,
    blockedInstances,
    totalInvitations,
    unusedInvitations,
    pendingReports,
  ] = await Promise.all([
    userRepository.count(false),
    userRepository.count(true),
    noteRepository.count(),
    instanceBlockRepository.count(),
    invitationCodeRepository.count(),
    invitationCodeRepository.countUnused(),
    userReportRepository.count({ status: "pending" }),
  ]);

  return c.json({
    users: {
      total: totalUsers,
      local: localUsers,
      remote: totalUsers - localUsers,
    },
    notes: {
      total: totalNotes,
    },
    federation: {
      blockedInstances,
    },
    invitations: {
      total: totalInvitations,
      unused: unusedInvitations,
    },
    moderation: {
      pendingReports,
    },
  });
});

// ============================================================================
// Storage Management Endpoints
// ============================================================================

/**
 * Get Instance-wide Storage Statistics
 *
 * GET /api/admin/storage/stats
 *
 * Returns total storage usage across all users and system files.
 */
app.get("/storage/stats", async (c) => {
  const driveFileRepository = c.get("driveFileRepository");
  const userRepository = c.get("userRepository");

  // Get all files (this might need pagination for very large instances)
  const allFiles = await driveFileRepository.findAll({ limit: 100000 });

  // Calculate totals
  let totalSize = 0;
  let userFilesSize = 0;
  let systemFilesSize = 0;
  let userFilesCount = 0;
  let systemFilesCount = 0;

  const byType: Record<string, { count: number; size: number }> = {};
  const byUser: Record<string, { count: number; size: number; username?: string }> = {};

  for (const file of allFiles) {
    totalSize += file.size;
    const source = (file as any).source || "user";

    if (source === "system") {
      systemFilesSize += file.size;
      systemFilesCount++;
    } else {
      userFilesSize += file.size;
      userFilesCount++;
    }

    // By type
    const category = getFileCategoryAdmin(file.type);
    if (!byType[category]) {
      byType[category] = { count: 0, size: 0 };
    }
    byType[category].count++;
    byType[category].size += file.size;

    // By user
    if (!byUser[file.userId]) {
      byUser[file.userId] = { count: 0, size: 0 };
    }
    const userData = byUser[file.userId];
    if (userData) {
      userData.count++;
      userData.size += file.size;
    }
  }

  // Get top users by storage
  const topUsers = Object.entries(byUser)
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, 10);

  // Fetch usernames for top users
  for (const [userId, data] of topUsers) {
    const user = await userRepository.findById(userId);
    if (user) {
      data.username = user.username;
    }
  }

  return c.json({
    totalFiles: allFiles.length,
    totalSize,
    totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
    userFiles: {
      count: userFilesCount,
      size: userFilesSize,
      sizeMB: Math.round((userFilesSize / (1024 * 1024)) * 100) / 100,
    },
    systemFiles: {
      count: systemFilesCount,
      size: systemFilesSize,
      sizeMB: Math.round((systemFilesSize / (1024 * 1024)) * 100) / 100,
    },
    byType,
    topUsers: topUsers.map(([userId, data]) => ({
      userId,
      ...data,
      sizeMB: Math.round((data.size / (1024 * 1024)) * 100) / 100,
    })),
  });
});

/**
 * Get System Files
 *
 * GET /api/admin/storage/system-files
 *
 * Returns files marked as system files (emojis, instance assets, etc.)
 */
app.get("/storage/system-files", async (c) => {
  const driveFileRepository = c.get("driveFileRepository");
  const { limit, offset } = parsePagination(c);

  const allFiles = await driveFileRepository.findAll({ limit: 10000 });
  const systemFiles = allFiles.filter((f: any) => f.source === "system");

  const paginatedFiles = systemFiles.slice(offset, offset + limit);

  return c.json({
    files: paginatedFiles,
    total: systemFiles.length,
  });
});

/**
 * Get User's Storage Details (Admin)
 *
 * GET /api/admin/storage/users/:userId
 *
 * Returns detailed storage information for a specific user.
 */
app.get("/storage/users/:userId", async (c) => {
  const userRepository = c.get("userRepository");
  const driveFileRepository = c.get("driveFileRepository");
  const roleService = c.get("roleService");
  const userId = c.req.param("userId");

  const user = await userRepository.findById(userId);
  if (!user) {
    return errorResponse(c, "User not found", 404);
  }

  const files = await driveFileRepository.findByUserId(userId);
  const quotaMb = await roleService.getDriveCapacity(userId);

  const totalSize = files.reduce((sum: number, f: any) => sum + f.size, 0);

  // Group by source
  const userFiles = files.filter((f: any) => f.source === "user" || !f.source);
  const systemFiles = files.filter((f: any) => f.source === "system");

  return c.json({
    user: {
      id: user.id,
      username: user.username,
      host: user.host,
    },
    storage: {
      totalFiles: files.length,
      totalSize,
      totalSizeMB: Math.round((totalSize / (1024 * 1024)) * 100) / 100,
      quotaMB: quotaMb,
      isUnlimited: quotaMb === -1,
      usagePercent: quotaMb === -1 ? 0 : Math.round((totalSize / (quotaMb * 1024 * 1024)) * 100),
    },
    fileCount: {
      user: userFiles.length,
      system: systemFiles.length,
    },
    files,
  });
});

/**
 * Delete File (Admin)
 *
 * DELETE /api/admin/storage/files/:fileId
 *
 * Deletes a file regardless of ownership.
 */
app.delete("/storage/files/:fileId", async (c) => {
  const driveFileRepository = c.get("driveFileRepository");
  const fileStorage = c.get("fileStorage");
  const fileId = c.req.param("fileId");

  const file = await driveFileRepository.findById(fileId);
  if (!file) {
    return errorResponse(c, "File not found", 404);
  }

  // Delete from storage
  try {
    await fileStorage.delete(file.storageKey);
  } catch (error) {
    console.error("Failed to delete file from storage:", error);
    // Continue to delete database record even if storage deletion fails
  }

  // Delete from database
  await driveFileRepository.delete(fileId);

  return c.json({ success: true, message: "File deleted" });
});

/**
 * Update User's Storage Quota
 *
 * PATCH /api/admin/storage/users/:userId/quota
 *
 * Updates a user's storage quota.
 *
 * Request Body:
 * ```json
 * {
 *   "quotaMB": 500  // -1 for unlimited
 * }
 * ```
 */
app.patch("/storage/users/:userId/quota", async (c) => {
  const userRepository = c.get("userRepository");
  const userId = c.req.param("userId");

  const user = await userRepository.findById(userId);
  if (!user) {
    return errorResponse(c, "User not found", 404);
  }

  // Cannot modify remote users
  if (user.host !== null) {
    return errorResponse(c, "Cannot modify remote user storage quota");
  }

  const body = await c.req.json();
  if (typeof body.quotaMB !== "number") {
    return errorResponse(c, "quotaMB must be a number");
  }

  // Update user's storageQuotaMb
  const updatedUser = await userRepository.update(userId, {
    storageQuotaMb: body.quotaMB === -1 ? null : body.quotaMB,
  });

  return c.json({
    success: true,
    user: sanitizeUser(updatedUser),
    quotaMB: body.quotaMB,
  });
});

/**
 * Categorize file by MIME type (admin version)
 */
function getFileCategoryAdmin(mimeType: string): string {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("text/")) return "text";
  if (mimeType.includes("pdf")) return "document";
  return "other";
}

export default app;
