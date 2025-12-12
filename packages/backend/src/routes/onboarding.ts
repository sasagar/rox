/**
 * Server Onboarding API Routes
 *
 * Provides endpoints for initial server setup wizard.
 * These endpoints are only accessible when onboarding has not been completed.
 *
 * @module routes/onboarding
 */

import { Hono } from "hono";
import { AuthService } from "../services/AuthService.js";
import { logger } from "../lib/logger.js";
import type { Context } from "hono";

const app = new Hono();

/**
 * Check if the server needs onboarding
 * Onboarding is needed if:
 * 1. onboarding.completed setting is false/not set, AND
 * 2. No local users exist (first user becomes admin automatically)
 */
const needsOnboarding = async (c: Context): Promise<boolean> => {
  const instanceSettingsService = c.get("instanceSettingsService");
  const userRepository = c.get("userRepository");

  // Check if onboarding has been completed
  const onboardingCompleted = await instanceSettingsService.isOnboardingCompleted();
  if (onboardingCompleted) return false;

  // Check if any local users exist (first user becomes admin automatically)
  const localUserCount = await userRepository.count(true);
  if (localUserCount > 0) {
    // If users exist but onboarding flag not set, mark as completed
    await instanceSettingsService.setOnboardingCompleted(true);
    return false;
  }

  return true;
};

/**
 * Guard middleware to ensure onboarding operations are only allowed when needed
 */
const requireOnboardingMode = async (c: Context, next: () => Promise<void>) => {
  const needs = await needsOnboarding(c);
  if (!needs) {
    return c.json({ error: "Onboarding already completed" }, 403);
  }
  return next();
};

/**
 * Onboarding Status
 *
 * GET /api/onboarding/status
 *
 * Returns whether the server needs initial setup.
 */
app.get("/status", async (c) => {
  const needs = await needsOnboarding(c);
  return c.json({
    needsOnboarding: needs,
  });
});

/**
 * Complete Onboarding
 *
 * POST /api/onboarding/complete
 *
 * Creates the initial admin user and configures instance settings.
 *
 * Request Body:
 * {
 *   "admin": {
 *     "username": "admin",
 *     "email": "admin@example.com",
 *     "password": "securePassword123",
 *     "name": "Administrator" // optional
 *   },
 *   "instance": {
 *     "name": "My Rox Instance",
 *     "description": "A Rox server", // optional
 *     "maintainerEmail": "admin@example.com" // optional
 *   },
 *   "registration": {
 *     "enabled": true,
 *     "inviteOnly": false,
 *     "approvalRequired": false
 *   }
 * }
 */
app.post("/complete", requireOnboardingMode, async (c) => {
  try {
    const body = await c.req.json();
    const { admin, instance, registration } = body;

    // Validate required fields
    if (!admin?.username || !admin?.email || !admin?.password) {
      return c.json(
        { error: "Admin username, email, and password are required" },
        400,
      );
    }

    if (!instance?.name) {
      return c.json({ error: "Instance name is required" }, 400);
    }

    const userRepository = c.get("userRepository");
    const sessionRepository = c.get("sessionRepository");
    const instanceSettingsService = c.get("instanceSettingsService");
    const blockedUsernameService = c.get("blockedUsernameService");
    const authService = new AuthService(userRepository, sessionRepository, blockedUsernameService);

    // Check if username or email already exists
    const existingUsername = await userRepository.findByUsername(admin.username);
    if (existingUsername) {
      return c.json({ error: "Username already taken" }, 400);
    }

    const existingEmail = await userRepository.findByEmail(admin.email);
    if (existingEmail) {
      return c.json({ error: "Email already registered" }, 400);
    }

    // Create admin user (first user becomes admin automatically via AuthService.register)
    const { user, session } = await authService.register({
      username: admin.username,
      email: admin.email,
      password: admin.password,
      name: admin.name || admin.username,
    });

    // Update instance settings
    await instanceSettingsService.updateInstanceMetadata({
      name: instance.name,
      description: instance.description || "",
      maintainerEmail: instance.maintainerEmail || admin.email,
    });

    // Update registration settings
    if (registration) {
      await instanceSettingsService.updateRegistrationSettings({
        enabled: registration.enabled ?? true,
        inviteOnly: registration.inviteOnly ?? false,
        approvalRequired: registration.approvalRequired ?? false,
      });
    }

    // Mark onboarding as completed
    await instanceSettingsService.setOnboardingCompleted(true, user.id);

    logger.info({ userId: user.id }, "Onboarding completed successfully");

    return c.json(
      {
        message: "Onboarding completed successfully",
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          name: user.displayName,
          isAdmin: user.isAdmin,
        },
        session: {
          token: session.token,
          expiresAt: session.expiresAt,
        },
      },
      201,
    );
  } catch (error) {
    logger.error({ error }, "Failed to complete onboarding");
    return c.json({ error: "Failed to complete onboarding" }, 500);
  }
});

export default app;
