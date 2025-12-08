/**
 * OAuth Authentication Routes
 *
 * Provides endpoints for OAuth authentication with external providers.
 * Supports GitHub, Google, Discord, and Mastodon.
 *
 * @module routes/oauth
 */

import { Hono } from "hono";
import { setCookie, getCookie } from "hono/cookie";
import { OAuthService } from "../services/OAuthService.js";
import { requireAuth } from "../middleware/auth.js";
import { rateLimit, RateLimitPresets } from "../middleware/rateLimit.js";
import { logger } from "../lib/logger.js";
import { generateId } from "shared";
import type { Context } from "hono";
import type { OAuthProvider } from "../interfaces/repositories/IOAuthAccountRepository.js";

const app = new Hono();

// State cookie name for CSRF protection
const STATE_COOKIE_NAME = "oauth_state";
const STATE_COOKIE_MAX_AGE = 600; // 10 minutes

/**
 * Get OAuth service instance
 */
const getOAuthService = (c: Context): OAuthService => {
  const oauthAccountRepository = c.get("oauthAccountRepository");
  const userRepository = c.get("userRepository");
  const sessionRepository = c.get("sessionRepository");
  return new OAuthService(oauthAccountRepository, userRepository, sessionRepository);
};

/**
 * Validate OAuth provider parameter
 */
const isValidProvider = (provider: string): provider is OAuthProvider => {
  return ["github", "google", "discord", "mastodon"].includes(provider);
};

/**
 * Get enabled OAuth providers
 *
 * GET /api/auth/oauth/providers
 *
 * Returns list of enabled OAuth providers based on environment configuration.
 */
app.get("/providers", async (c) => {
  const oauthService = getOAuthService(c);
  const providers = oauthService.getEnabledProviders();

  return c.json({
    providers: providers.map((provider) => ({
      id: provider,
      name: provider.charAt(0).toUpperCase() + provider.slice(1),
    })),
  });
});

/**
 * Initiate OAuth authorization
 *
 * GET /api/auth/oauth/:provider/authorize
 *
 * Redirects user to OAuth provider's authorization page.
 * Sets a state cookie for CSRF protection.
 */
app.get(
  "/:provider/authorize",
  rateLimit(RateLimitPresets.login),
  async (c) => {
    const provider = c.req.param("provider");

    if (!isValidProvider(provider)) {
      return c.json({ error: "Invalid OAuth provider" }, 400);
    }

    try {
      const oauthService = getOAuthService(c);

      if (!oauthService.isProviderEnabled(provider)) {
        return c.json({ error: `${provider} OAuth is not configured` }, 400);
      }

      // Generate state for CSRF protection
      const state = generateId();

      // Store state in cookie
      setCookie(c, STATE_COOKIE_NAME, state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: STATE_COOKIE_MAX_AGE,
        path: "/",
      });

      // Get authorization URL
      const authUrl = oauthService.getAuthorizationUrl(provider, state);

      // Redirect to provider
      return c.redirect(authUrl);
    } catch (error) {
      logger.error({ err: error, provider }, "OAuth authorize error");
      return c.json(
        { error: error instanceof Error ? error.message : "OAuth authorization failed" },
        500,
      );
    }
  },
);

/**
 * OAuth callback handler
 *
 * GET /api/auth/oauth/:provider/callback
 *
 * Handles the OAuth callback from the provider.
 * Verifies state, exchanges code for tokens, and creates/links user.
 */
app.get(
  "/:provider/callback",
  rateLimit(RateLimitPresets.login),
  async (c) => {
    const provider = c.req.param("provider");
    const code = c.req.query("code");
    const state = c.req.query("state");
    const error = c.req.query("error");
    const errorDescription = c.req.query("error_description");

    // Handle OAuth error from provider
    if (error) {
      logger.warn({ provider, error, errorDescription }, "OAuth provider returned error");
      return c.redirect(`/login?error=${encodeURIComponent(errorDescription || error)}`);
    }

    if (!isValidProvider(provider)) {
      return c.redirect("/login?error=Invalid+OAuth+provider");
    }

    if (!code || !state) {
      return c.redirect("/login?error=Missing+OAuth+parameters");
    }

    try {
      // Verify state against cookie
      const storedState = getCookie(c, STATE_COOKIE_NAME);
      if (!storedState || storedState !== state) {
        logger.warn({ provider }, "OAuth state mismatch");
        return c.redirect("/login?error=Invalid+OAuth+state");
      }

      // Clear state cookie
      setCookie(c, STATE_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: 0,
        path: "/",
      });

      const oauthService = getOAuthService(c);

      // Exchange code for tokens and get user profile
      const { tokens, profile } = await oauthService.handleCallback(provider, code);

      // Find or create user
      const { user, isNew } = await oauthService.findOrCreateUser(provider, profile, tokens);

      // Check if user is suspended
      if (user.isSuspended) {
        logger.warn({ userId: user.id, provider }, "Suspended user attempted OAuth login");
        return c.redirect("/login?error=Account+is+suspended");
      }

      // Create session
      const userAgent = c.req.header("User-Agent") || undefined;
      const forwardedFor = c.req.header("X-Forwarded-For");
      const ipAddress = (forwardedFor ? forwardedFor.split(",")[0]?.trim() : undefined) ||
        c.req.header("X-Real-IP") ||
        undefined;
      const sessionToken = await oauthService.createSession(user.id, userAgent, ipAddress);

      // Set session cookie
      const sessionExpiryDays = parseInt(process.env.SESSION_EXPIRY_DAYS || "30", 10);
      setCookie(c, "session", sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        maxAge: sessionExpiryDays * 24 * 60 * 60,
        path: "/",
      });

      logger.info({ userId: user.id, provider, isNew }, "OAuth login successful");

      // Redirect to home or onboarding for new users
      const redirectUrl = isNew ? "/settings/profile" : "/";
      return c.redirect(redirectUrl);
    } catch (error) {
      logger.error({ err: error, provider }, "OAuth callback error");
      const message = error instanceof Error ? error.message : "OAuth authentication failed";
      return c.redirect(`/login?error=${encodeURIComponent(message)}`);
    }
  },
);

/**
 * Link OAuth account to existing user
 *
 * POST /api/auth/oauth/:provider/link
 *
 * Links an OAuth provider account to the currently authenticated user.
 * Requires authentication.
 */
app.post(
  "/:provider/link",
  requireAuth,
  rateLimit(RateLimitPresets.login),
  async (c) => {
    const provider = c.req.param("provider");
    const user = c.get("user")!;

    if (!isValidProvider(provider)) {
      return c.json({ error: "Invalid OAuth provider" }, 400);
    }

    try {
      const body = await c.req.json<{ code: string }>();

      if (!body.code) {
        return c.json({ error: "Missing authorization code" }, 400);
      }

      const oauthService = getOAuthService(c);
      const oauthAccount = await oauthService.linkAccount(user.id, provider, body.code);

      logger.info({ userId: user.id, provider }, "OAuth account linked");

      return c.json({
        success: true,
        account: {
          provider: oauthAccount.provider,
          providerUsername: oauthAccount.providerUsername,
          createdAt: oauthAccount.createdAt,
        },
      });
    } catch (error) {
      logger.error({ err: error, provider, userId: user.id }, "OAuth link error");
      return c.json(
        { error: error instanceof Error ? error.message : "Failed to link OAuth account" },
        400,
      );
    }
  },
);

/**
 * Unlink OAuth account from user
 *
 * DELETE /api/auth/oauth/:provider
 *
 * Removes an OAuth provider link from the authenticated user.
 * Requires authentication.
 */
app.delete(
  "/:provider",
  requireAuth,
  rateLimit(RateLimitPresets.login),
  async (c) => {
    const provider = c.req.param("provider");
    const user = c.get("user")!;

    if (!isValidProvider(provider)) {
      return c.json({ error: "Invalid OAuth provider" }, 400);
    }

    try {
      const oauthService = getOAuthService(c);
      await oauthService.unlinkAccount(user.id, provider);

      logger.info({ userId: user.id, provider }, "OAuth account unlinked");

      return c.json({ success: true });
    } catch (error) {
      logger.error({ err: error, provider, userId: user.id }, "OAuth unlink error");
      return c.json(
        { error: error instanceof Error ? error.message : "Failed to unlink OAuth account" },
        400,
      );
    }
  },
);

/**
 * Get linked OAuth accounts
 *
 * GET /api/auth/oauth/accounts
 *
 * Returns list of OAuth providers linked to the authenticated user.
 * Requires authentication.
 */
app.get(
  "/accounts",
  requireAuth,
  async (c) => {
    const user = c.get("user")!;

    try {
      const oauthService = getOAuthService(c);
      const accounts = await oauthService.getLinkedAccounts(user.id);

      return c.json({
        accounts: accounts.map((account) => ({
          provider: account.provider,
          providerUsername: account.providerUsername,
          providerEmail: account.providerEmail,
          createdAt: account.createdAt,
        })),
      });
    } catch (error) {
      logger.error({ err: error, userId: user.id }, "Get OAuth accounts error");
      return c.json(
        { error: error instanceof Error ? error.message : "Failed to get linked accounts" },
        500,
      );
    }
  },
);

export default app;
