/**
 * Invitation API Routes
 *
 * Provides endpoints for users to manage their own invitation codes.
 * Users need the 'canInvite' permission (via roles) to create invitations.
 *
 * @module routes/invitations
 */

import { Hono } from "hono";
import { requirePermission, requireAuth } from "../middleware/auth.js";

const app = new Hono();

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
 * Get My Invitations
 *
 * GET /api/invitations
 *
 * Returns invitation codes created by the authenticated user.
 */
app.get("/", requireAuth(), async (c) => {
  const invitationCodeRepository = c.get("invitationCodeRepository");
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const codes = await invitationCodeRepository.findByCreatedBy(user.id);

  return c.json({ codes });
});

/**
 * Get My Invite Permissions
 *
 * GET /api/invitations/permissions
 *
 * Returns the user's invitation permissions (can invite, limit, etc.)
 */
app.get("/permissions", requireAuth(), async (c) => {
  const roleService = c.get("roleService");
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const canInvite = await roleService.canInvite(user.id);
  const inviteLimit = await roleService.getInviteLimit(user.id);
  const policies = await roleService.getEffectivePolicies(user.id);

  return c.json({
    canInvite,
    inviteLimit, // -1 = unlimited, 0 = cannot invite
    inviteLimitCycle: policies.inviteLimitCycle ?? 24, // hours
  });
});

/**
 * Create Invitation Code
 *
 * POST /api/invitations
 *
 * Creates a new invitation code. Requires the 'canInvite' permission.
 *
 * Request Body:
 * ```json
 * {
 *   "expiresAt": "2025-12-31T23:59:59Z", // optional
 *   "maxUses": 1 // optional, default 1
 * }
 * ```
 */
app.post("/", requirePermission("canInvite"), async (c) => {
  const invitationCodeRepository = c.get("invitationCodeRepository");
  const roleService = c.get("roleService");
  const user = c.get("user");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Check invite limit
  const inviteLimit = await roleService.getInviteLimit(user.id);
  if (inviteLimit === 0) {
    return c.json({ error: "You do not have permission to create invitations" }, 403);
  }

  // Check if user has reached their limit (if not unlimited)
  if (inviteLimit > 0) {
    const policies = await roleService.getEffectivePolicies(user.id);
    const cycleHours = policies.inviteLimitCycle ?? 24;
    const recentCount = await invitationCodeRepository.countRecentByCreator(user.id, cycleHours);

    if (recentCount >= inviteLimit) {
      return c.json(
        {
          error: `You have reached your invitation limit (${inviteLimit} per ${cycleHours} hours)`,
          limit: inviteLimit,
          used: recentCount,
          cycleHours,
        },
        429,
      );
    }
  }

  const body = await c.req.json().catch(() => ({}));
  const code = generateInvitationCode();

  // Check if code already exists (very unlikely but possible)
  const existing = await invitationCodeRepository.findByCode(code);
  if (existing) {
    // Generate a new one
    const newCode = generateInvitationCode();
    const invitation = await invitationCodeRepository.create({
      code: newCode,
      createdById: user.id,
      expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      maxUses: body.maxUses || 1,
    });
    return c.json(invitation, 201);
  }

  const invitation = await invitationCodeRepository.create({
    code,
    createdById: user.id,
    expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
    maxUses: body.maxUses || 1,
  });

  return c.json(invitation, 201);
});

/**
 * Delete My Invitation Code
 *
 * DELETE /api/invitations/:id
 *
 * Deletes an invitation code created by the authenticated user.
 */
app.delete("/:id", requireAuth(), async (c) => {
  const invitationCodeRepository = c.get("invitationCodeRepository");
  const user = c.get("user");
  const id = c.req.param("id");

  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Find the invitation
  const invitation = await invitationCodeRepository.findById(id);
  if (!invitation) {
    return c.json({ error: "Invitation code not found" }, 404);
  }

  // Check ownership (unless admin)
  if (invitation.createdById !== user.id && !user.isAdmin) {
    const roleService = c.get("roleService");
    const isAdmin = await roleService.isAdmin(user.id);
    if (!isAdmin) {
      return c.json({ error: "You can only delete your own invitation codes" }, 403);
    }
  }

  await invitationCodeRepository.delete(id);

  return c.json({ success: true, message: "Invitation code deleted" });
});

export default app;
