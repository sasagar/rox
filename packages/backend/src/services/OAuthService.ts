/**
 * OAuth Service
 *
 * Handles OAuth authentication flow for external providers.
 * Supports GitHub, Google, Discord, and Mastodon.
 *
 * @module services/OAuthService
 */

import { generateId } from "shared";
import type { IOAuthAccountRepository, OAuthProvider } from "../interfaces/repositories/IOAuthAccountRepository.js";
import type { IUserRepository } from "../interfaces/repositories/IUserRepository.js";
import type { ISessionRepository } from "../interfaces/repositories/ISessionRepository.js";
import type { User, OAuthAccount } from "../db/schema/pg.js";
import { logger } from "../lib/logger.js";
import { generateKeyPair } from "../utils/crypto.js";

/**
 * GitHub user profile response
 */
interface GitHubUser {
  id: number;
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

/**
 * GitHub email response
 */
interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

/**
 * Google user profile response
 */
interface GoogleUser {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

/**
 * Discord user profile response
 */
interface DiscordUser {
  id: string;
  username: string;
  global_name?: string;
  email?: string;
  avatar?: string;
}

/**
 * Mastodon user profile response
 */
interface MastodonUser {
  id: string;
  username: string;
  display_name?: string;
  avatar?: string;
}

/**
 * OAuth token error response
 */
interface OAuthErrorResponse {
  error?: string;
  error_description?: string;
}

/**
 * OAuth provider configuration
 */
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  // Mastodon-specific: instance URL
  instanceUrl?: string;
}

/**
 * OAuth token response from provider
 */
interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

/**
 * Normalized user profile from OAuth provider
 */
export interface OAuthUserProfile {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

/**
 * OAuth Service for handling external authentication
 */
export class OAuthService {
  private configs: Partial<Record<OAuthProvider, OAuthProviderConfig>> = {};

  constructor(
    private oauthAccountRepository: IOAuthAccountRepository,
    private userRepository: IUserRepository,
    private sessionRepository: ISessionRepository,
  ) {
    // Load configs from environment
    this.loadConfigs();
  }

  /**
   * Load OAuth provider configurations from environment variables
   */
  private loadConfigs(): void {
    // GitHub
    if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
      this.configs.github = {
        clientId: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        redirectUri: process.env.GITHUB_REDIRECT_URI || `${process.env.URL}/auth/callback/github`,
      };
    }

    // Google
    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      this.configs.google = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || `${process.env.URL}/auth/callback/google`,
      };
    }

    // Discord
    if (process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET) {
      this.configs.discord = {
        clientId: process.env.DISCORD_CLIENT_ID,
        clientSecret: process.env.DISCORD_CLIENT_SECRET,
        redirectUri: process.env.DISCORD_REDIRECT_URI || `${process.env.URL}/auth/callback/discord`,
      };
    }

    // Mastodon (requires instance URL)
    if (
      process.env.MASTODON_CLIENT_ID &&
      process.env.MASTODON_CLIENT_SECRET &&
      process.env.MASTODON_INSTANCE_URL
    ) {
      this.configs.mastodon = {
        clientId: process.env.MASTODON_CLIENT_ID,
        clientSecret: process.env.MASTODON_CLIENT_SECRET,
        redirectUri: process.env.MASTODON_REDIRECT_URI || `${process.env.URL}/auth/callback/mastodon`,
        instanceUrl: process.env.MASTODON_INSTANCE_URL,
      };
    }
  }

  /**
   * Check if a provider is configured
   */
  isProviderEnabled(provider: OAuthProvider): boolean {
    return !!this.configs[provider];
  }

  /**
   * Get list of enabled providers
   */
  getEnabledProviders(): OAuthProvider[] {
    return Object.keys(this.configs) as OAuthProvider[];
  }

  /**
   * Get OAuth authorization URL for a provider
   */
  getAuthorizationUrl(provider: OAuthProvider, state: string): string {
    const config = this.configs[provider];
    if (!config) {
      throw new Error(`OAuth provider ${provider} is not configured`);
    }

    switch (provider) {
      case "github":
        return this.getGitHubAuthUrl(config, state);
      case "google":
        return this.getGoogleAuthUrl(config, state);
      case "discord":
        return this.getDiscordAuthUrl(config, state);
      case "mastodon":
        return this.getMastodonAuthUrl(config, state);
      default:
        throw new Error(`Unknown OAuth provider: ${provider}`);
    }
  }

  private getGitHubAuthUrl(config: OAuthProviderConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      scope: "read:user user:email",
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  }

  private getGoogleAuthUrl(config: OAuthProviderConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      access_type: "offline",
      prompt: "consent",
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  private getDiscordAuthUrl(config: OAuthProviderConfig, state: string): string {
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "identify email",
      state,
    });
    return `https://discord.com/api/oauth2/authorize?${params}`;
  }

  private getMastodonAuthUrl(config: OAuthProviderConfig, state: string): string {
    if (!config.instanceUrl) {
      throw new Error("Mastodon instance URL is required");
    }
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      scope: "read:accounts",
      state,
    });
    return `${config.instanceUrl}/oauth/authorize?${params}`;
  }

  /**
   * Exchange authorization code for tokens and get user profile
   */
  async handleCallback(
    provider: OAuthProvider,
    code: string,
  ): Promise<{ tokens: OAuthTokenResponse; profile: OAuthUserProfile }> {
    const config = this.configs[provider];
    if (!config) {
      throw new Error(`OAuth provider ${provider} is not configured`);
    }

    // Exchange code for tokens
    const tokens = await this.exchangeCode(provider, config, code);

    // Get user profile
    const profile = await this.getUserProfile(provider, config, tokens.access_token);

    return { tokens, profile };
  }

  private async exchangeCode(
    provider: OAuthProvider,
    config: OAuthProviderConfig,
    code: string,
  ): Promise<OAuthTokenResponse> {
    switch (provider) {
      case "github":
        return this.exchangeGitHubCode(config, code);
      case "google":
        return this.exchangeGoogleCode(config, code);
      case "discord":
        return this.exchangeDiscordCode(config, code);
      case "mastodon":
        return this.exchangeMastodonCode(config, code);
      default:
        throw new Error(`Unknown OAuth provider: ${provider}`);
    }
  }

  private async exchangeGitHubCode(config: OAuthProviderConfig, code: string): Promise<OAuthTokenResponse> {
    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!response.ok) {
      throw new Error(`GitHub token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as OAuthTokenResponse & OAuthErrorResponse;
    if (data.error) {
      throw new Error(`GitHub OAuth error: ${data.error_description || data.error}`);
    }

    return data as OAuthTokenResponse;
  }

  private async exchangeGoogleCode(config: OAuthProviderConfig, code: string): Promise<OAuthTokenResponse> {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new Error(`Google token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as OAuthTokenResponse & OAuthErrorResponse;
    if (data.error) {
      throw new Error(`Google OAuth error: ${data.error_description || data.error}`);
    }

    return data as OAuthTokenResponse;
  }

  private async exchangeDiscordCode(config: OAuthProviderConfig, code: string): Promise<OAuthTokenResponse> {
    const response = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!response.ok) {
      throw new Error(`Discord token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as OAuthTokenResponse & OAuthErrorResponse;
    if (data.error) {
      throw new Error(`Discord OAuth error: ${data.error_description || data.error}`);
    }

    return data as OAuthTokenResponse;
  }

  private async exchangeMastodonCode(config: OAuthProviderConfig, code: string): Promise<OAuthTokenResponse> {
    if (!config.instanceUrl) {
      throw new Error("Mastodon instance URL is required");
    }

    const response = await fetch(`${config.instanceUrl}/oauth/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: config.redirectUri,
        grant_type: "authorization_code",
        scope: "read:accounts",
      }),
    });

    if (!response.ok) {
      throw new Error(`Mastodon token exchange failed: ${response.status}`);
    }

    const data = (await response.json()) as OAuthTokenResponse & OAuthErrorResponse;
    if (data.error) {
      throw new Error(`Mastodon OAuth error: ${data.error_description || data.error}`);
    }

    return data as OAuthTokenResponse;
  }

  private async getUserProfile(
    provider: OAuthProvider,
    config: OAuthProviderConfig,
    accessToken: string,
  ): Promise<OAuthUserProfile> {
    switch (provider) {
      case "github":
        return this.getGitHubProfile(accessToken);
      case "google":
        return this.getGoogleProfile(accessToken);
      case "discord":
        return this.getDiscordProfile(accessToken);
      case "mastodon":
        return this.getMastodonProfile(config, accessToken);
      default:
        throw new Error(`Unknown OAuth provider: ${provider}`);
    }
  }

  private async getGitHubProfile(accessToken: string): Promise<OAuthUserProfile> {
    // Get user info
    const userResponse = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!userResponse.ok) {
      throw new Error(`Failed to get GitHub user profile: ${userResponse.status}`);
    }

    const user = (await userResponse.json()) as GitHubUser;

    // Get primary email if not public
    let email: string | null = user.email;
    if (!email) {
      const emailResponse = await fetch("https://api.github.com/user/emails", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/vnd.github.v3+json",
        },
      });

      if (emailResponse.ok) {
        const emails = (await emailResponse.json()) as GitHubEmail[];
        const primaryEmail = emails.find((e) => e.primary && e.verified);
        email = primaryEmail?.email || null;
      }
    }

    return {
      id: String(user.id),
      username: user.login,
      email,
      displayName: user.name || null,
      avatarUrl: user.avatar_url || null,
    };
  }

  private async getGoogleProfile(accessToken: string): Promise<OAuthUserProfile> {
    const response = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get Google user profile: ${response.status}`);
    }

    const user = (await response.json()) as GoogleUser;

    return {
      id: user.id,
      username: user.email?.split("@")[0] || user.id,
      email: user.email || null,
      displayName: user.name || null,
      avatarUrl: user.picture || null,
    };
  }

  private async getDiscordProfile(accessToken: string): Promise<OAuthUserProfile> {
    const response = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get Discord user profile: ${response.status}`);
    }

    const user = (await response.json()) as DiscordUser;

    // Discord avatar URL
    let avatarUrl: string | null = null;
    if (user.avatar) {
      const ext = user.avatar.startsWith("a_") ? "gif" : "png";
      avatarUrl = `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${ext}`;
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email || null,
      displayName: user.global_name || user.username,
      avatarUrl,
    };
  }

  private async getMastodonProfile(
    config: OAuthProviderConfig,
    accessToken: string,
  ): Promise<OAuthUserProfile> {
    if (!config.instanceUrl) {
      throw new Error("Mastodon instance URL is required");
    }

    const response = await fetch(`${config.instanceUrl}/api/v1/accounts/verify_credentials`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get Mastodon user profile: ${response.status}`);
    }

    const user = (await response.json()) as MastodonUser;

    return {
      id: user.id,
      username: user.username,
      email: null, // Mastodon doesn't expose email
      displayName: user.display_name || null,
      avatarUrl: user.avatar || null,
    };
  }

  /**
   * Find or create user from OAuth profile
   * Returns the user and a flag indicating if it's a new user
   */
  async findOrCreateUser(
    provider: OAuthProvider,
    profile: OAuthUserProfile,
    tokens: OAuthTokenResponse,
  ): Promise<{ user: User; isNew: boolean; oauthAccount: OAuthAccount }> {
    // Check if OAuth account already exists
    const existingOAuthAccount = await this.oauthAccountRepository.findByProviderAccount(
      provider,
      profile.id,
    );

    if (existingOAuthAccount) {
      // Update tokens
      const updatedAccount = await this.oauthAccountRepository.updateTokens(existingOAuthAccount.id, {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || null,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
        scope: tokens.scope || null,
      });

      const user = await this.userRepository.findById(existingOAuthAccount.userId);
      if (!user) {
        throw new Error("User not found for OAuth account");
      }

      logger.info({ provider, userId: user.id }, "OAuth login: existing user");
      return { user, isNew: false, oauthAccount: updatedAccount };
    }

    // Check if user with same email exists (to link accounts)
    let user: User | null = null;
    let isNew = false;

    if (profile.email) {
      user = await this.userRepository.findByEmail(profile.email);
    }

    if (!user) {
      // Create new user
      const baseUsername = this.sanitizeUsername(profile.username);
      let username = baseUsername;
      let attempt = 0;

      // Ensure unique username
      while (await this.userRepository.findByUsername(username)) {
        attempt++;
        username = `${baseUsername}${attempt}`;
      }

      // Generate ActivityPub keypair for OAuth users
      const { publicKey, privateKey } = generateKeyPair();
      const baseUrl = process.env.URL || "http://localhost:3000";

      user = await this.userRepository.create({
        id: generateId(),
        username,
        email: profile.email || `${profile.id}@${provider}.oauth`,
        // OAuth-only users get a random unusable password hash
        // This hash is not a valid bcrypt hash, so password login will always fail
        passwordHash: `oauth:${provider}:${generateId()}`,
        displayName: profile.displayName,
        host: null, // Local user
        avatarUrl: profile.avatarUrl,
        bannerUrl: null,
        bio: null,
        isAdmin: false,
        isSuspended: false,
        isDeleted: false,
        deletedAt: null,
        isSystemUser: false,
        publicKey,
        privateKey,
        customCss: null,
        uiSettings: null,
        // ActivityPub fields for local users
        inbox: `${baseUrl}/users/${username}/inbox`,
        outbox: `${baseUrl}/users/${username}/outbox`,
        followersUrl: `${baseUrl}/users/${username}/followers`,
        followingUrl: `${baseUrl}/users/${username}/following`,
        uri: `${baseUrl}/users/${username}`,
        sharedInbox: null,
        // Account migration fields
        alsoKnownAs: [],
        movedTo: null,
        movedAt: null,
        // Profile emojis
        profileEmojis: [],
        // Storage quota
        storageQuotaMb: null,
        // Remote actor fetch status (not applicable to local users)
        goneDetectedAt: null,
        fetchFailureCount: 0,
        lastFetchAttemptAt: null,
        lastFetchError: null,
        // Follower/following counts start at 0
        followersCount: 0,
        followingCount: 0,
      });

      isNew = true;
      logger.info({ provider, userId: user.id, username }, "OAuth login: new user created");
    } else {
      logger.info({ provider, userId: user.id }, "OAuth login: linked to existing user by email");
    }

    // Create OAuth account link
    const oauthAccount = await this.oauthAccountRepository.create({
      id: generateId(),
      userId: user.id,
      provider,
      providerAccountId: profile.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      scope: tokens.scope || null,
      tokenType: tokens.token_type || "Bearer",
      providerUsername: profile.username,
      providerEmail: profile.email,
    });

    return { user, isNew, oauthAccount };
  }

  /**
   * Create a session for the user
   * @param userId - User ID
   * @param userAgent - Optional user agent string
   * @param ipAddress - Optional IP address
   */
  async createSession(userId: string, userAgent?: string, ipAddress?: string): Promise<string> {
    const sessionExpiryDays = parseInt(process.env.SESSION_EXPIRY_DAYS || "30", 10);
    const token = generateId() + generateId(); // 32 char token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + sessionExpiryDays);

    await this.sessionRepository.create({
      id: generateId(),
      userId,
      token,
      expiresAt,
      userAgent: userAgent || null,
      ipAddress: ipAddress || null,
    });

    return token;
  }

  /**
   * Link OAuth account to existing user
   */
  async linkAccount(
    userId: string,
    provider: OAuthProvider,
    code: string,
  ): Promise<OAuthAccount> {
    // Check if already linked
    const existing = await this.oauthAccountRepository.findByUserAndProvider(userId, provider);
    if (existing) {
      throw new Error(`${provider} account is already linked`);
    }

    // Exchange code and get profile
    const { tokens, profile } = await this.handleCallback(provider, code);

    // Check if this provider account is linked to another user
    const otherLink = await this.oauthAccountRepository.findByProviderAccount(provider, profile.id);
    if (otherLink) {
      throw new Error(`This ${provider} account is already linked to another user`);
    }

    // Create link
    const oauthAccount = await this.oauthAccountRepository.create({
      id: generateId(),
      userId,
      provider,
      providerAccountId: profile.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      tokenExpiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null,
      scope: tokens.scope || null,
      tokenType: tokens.token_type || "Bearer",
      providerUsername: profile.username,
      providerEmail: profile.email,
    });

    logger.info({ provider, userId }, "OAuth account linked");
    return oauthAccount;
  }

  /**
   * Unlink OAuth account from user
   */
  async unlinkAccount(userId: string, provider: OAuthProvider): Promise<void> {
    // Check if user has other login methods before unlinking
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Count linked OAuth accounts
    const linkedAccounts = await this.oauthAccountRepository.countByUserId(userId);

    // User must have password or at least one other OAuth account
    if (!user.passwordHash && linkedAccounts <= 1) {
      throw new Error("Cannot unlink the only login method. Set a password first.");
    }

    await this.oauthAccountRepository.deleteByUserAndProvider(userId, provider);
    logger.info({ provider, userId }, "OAuth account unlinked");
  }

  /**
   * Get linked OAuth accounts for user
   */
  async getLinkedAccounts(userId: string): Promise<OAuthAccount[]> {
    return this.oauthAccountRepository.findByUserId(userId);
  }

  /**
   * Sanitize username for use in this system
   */
  private sanitizeUsername(username: string): string {
    // Remove non-alphanumeric characters except underscore
    let sanitized = username.replace(/[^a-zA-Z0-9_]/g, "");

    // Ensure it starts with a letter
    if (!/^[a-zA-Z]/.test(sanitized)) {
      sanitized = "user" + sanitized;
    }

    // Truncate to max length
    if (sanitized.length > 20) {
      sanitized = sanitized.substring(0, 20);
    }

    // Ensure minimum length
    if (sanitized.length < 3) {
      sanitized = sanitized + generateId().substring(0, 3 - sanitized.length);
    }

    return sanitized.toLowerCase();
  }
}
