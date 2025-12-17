/**
 * Deck API Routes
 *
 * Provides endpoints for deck profile management.
 * Allows users to create, manage, and sync their deck layouts.
 *
 * @module routes/deck
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { requireAuth } from "../middleware/auth.js";
import { userRateLimit, RateLimitPresets } from "../middleware/rateLimit.js";
import type { IDeckProfileRepository } from "../interfaces/repositories/IDeckProfileRepository.js";
import type { DeckProfile, CreateDeckProfileInput, UpdateDeckProfileInput } from "shared";

const deck = new Hono();

/**
 * Helper to get deck profile repository from context
 */
function getDeckProfileRepository(c: Context): IDeckProfileRepository {
  return c.get("deckProfileRepository");
}

/**
 * Generate a unique profile ID
 */
function generateProfileId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * GET /api/deck/profiles
 *
 * Get all deck profiles for the current user
 *
 * @auth Required
 * @returns {DeckProfile[]} User's deck profiles
 */
deck.get("/profiles", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const repository = getDeckProfileRepository(c);

  try {
    const profiles = await repository.findByUserId(user.id);
    return c.json(profiles);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get profiles";
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /api/deck/profiles/:id
 *
 * Get a specific deck profile
 *
 * @auth Required
 * @param id - Profile ID
 * @returns {DeckProfile} The deck profile
 */
deck.get("/profiles/:id", requireAuth(), async (c: Context) => {
  const user = c.get("user")!;
  const repository = getDeckProfileRepository(c);
  const profileId = c.req.param("id");

  try {
    const profile = await repository.findById(profileId);

    if (!profile) {
      return c.json({ error: "Profile not found" }, 404);
    }

    // Ensure user owns this profile
    if (profile.userId !== user.id) {
      return c.json({ error: "Access denied" }, 403);
    }

    return c.json(profile);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to get profile";
    return c.json({ error: message }, 500);
  }
});

/**
 * POST /api/deck/profiles
 *
 * Create a new deck profile
 *
 * @auth Required
 * @body {CreateDeckProfileInput} Profile data
 * @returns {DeckProfile} Created profile
 */
deck.post(
  "/profiles",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const repository = getDeckProfileRepository(c);

    let body: CreateDeckProfileInput;
    try {
      body = (await c.req.json()) as CreateDeckProfileInput;
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.name?.trim()) {
      return c.json({ error: "name is required" }, 400);
    }

    try {
      // Check for duplicate name
      const exists = await repository.existsByUserIdAndName(user.id, body.name.trim());
      if (exists) {
        return c.json({ error: "A profile with this name already exists" }, 400);
      }

      // Check profile limit (max 10 profiles per user)
      const profileCount = await repository.countByUserId(user.id);
      if (profileCount >= 10) {
        return c.json({ error: "Maximum profile limit reached (10)" }, 400);
      }

      // If this is set as default, clear other defaults
      if (body.isDefault) {
        await repository.clearDefaultForUser(user.id);
      }

      // Make first profile default automatically
      const isDefault = body.isDefault ?? (profileCount === 0);

      const profile = await repository.create({
        id: generateProfileId(),
        userId: user.id,
        name: body.name.trim(),
        columns: body.columns ?? [],
        isDefault,
      });

      return c.json(profile, 201);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create profile";
      return c.json({ error: message }, 500);
    }
  },
);

/**
 * PATCH /api/deck/profiles/:id
 *
 * Update a deck profile
 *
 * @auth Required
 * @param id - Profile ID
 * @body {UpdateDeckProfileInput} Profile update data
 * @returns {DeckProfile} Updated profile
 */
deck.patch(
  "/profiles/:id",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const repository = getDeckProfileRepository(c);
    const profileId = c.req.param("id");

    let body: UpdateDeckProfileInput;
    try {
      body = (await c.req.json()) as UpdateDeckProfileInput;
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    try {
      // Verify ownership
      const existing = await repository.findById(profileId);
      if (!existing) {
        return c.json({ error: "Profile not found" }, 404);
      }
      if (existing.userId !== user.id) {
        return c.json({ error: "Access denied" }, 403);
      }

      // Check for duplicate name if name is being changed
      if (body.name && body.name.trim() !== existing.name) {
        const exists = await repository.existsByUserIdAndName(user.id, body.name.trim());
        if (exists) {
          return c.json({ error: "A profile with this name already exists" }, 400);
        }
      }

      // If setting as default, clear other defaults
      if (body.isDefault && !existing.isDefault) {
        await repository.clearDefaultForUser(user.id);
      }

      const updateData: Partial<Pick<DeckProfile, "name" | "columns" | "isDefault">> = {};
      if (body.name !== undefined) updateData.name = body.name.trim();
      if (body.columns !== undefined) updateData.columns = body.columns;
      if (body.isDefault !== undefined) updateData.isDefault = body.isDefault;

      if (Object.keys(updateData).length === 0) {
        return c.json({ error: "No fields to update" }, 400);
      }

      const updated = await repository.update(profileId, updateData);
      return c.json(updated);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to update profile";
      return c.json({ error: message }, 500);
    }
  },
);

/**
 * DELETE /api/deck/profiles/:id
 *
 * Delete a deck profile
 *
 * @auth Required
 * @param id - Profile ID
 * @returns {void}
 */
deck.delete(
  "/profiles/:id",
  requireAuth(),
  userRateLimit(RateLimitPresets.write),
  async (c: Context) => {
    const user = c.get("user")!;
    const repository = getDeckProfileRepository(c);
    const profileId = c.req.param("id");

    try {
      // Verify ownership
      const existing = await repository.findById(profileId);
      if (!existing) {
        return c.json({ error: "Profile not found" }, 404);
      }
      if (existing.userId !== user.id) {
        return c.json({ error: "Access denied" }, 403);
      }

      // Don't allow deleting the last profile
      const profileCount = await repository.countByUserId(user.id);
      if (profileCount <= 1) {
        return c.json({ error: "Cannot delete the last profile" }, 400);
      }

      await repository.delete(profileId);

      // If deleted profile was default, make another profile default
      if (existing.isDefault) {
        const remainingProfiles = await repository.findByUserId(user.id);
        if (remainingProfiles.length > 0 && remainingProfiles[0]) {
          try {
            await repository.update(remainingProfiles[0].id, { isDefault: true });
          } catch {
            // Profile may have been deleted concurrently; ignore
          }
        }
      }

      return c.json({ success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete profile";
      return c.json({ error: message }, 500);
    }
  },
);

export default deck;
