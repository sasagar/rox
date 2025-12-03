import type { IAuthProvider, AuthResult, OAuthConfig, OAuthCredentials } from "../types";
import { apiClient } from "../../api/client";

/**
 * OAuth authentication provider
 * Supports GitHub, Google, Discord, Mastodon OAuth flows
 */
export class OAuthProvider implements IAuthProvider {
  readonly method = "oauth" as const;
  private config: OAuthConfig;

  constructor(config: OAuthConfig) {
    this.config = config;
  }

  /**
   * Initiate OAuth flow by redirecting to provider
   *
   * @example
   * ```ts
   * const provider = new OAuthProvider({
   *   provider: 'github',
   *   clientId: 'xxx',
   *   redirectUri: 'http://localhost:3000/auth/callback',
   *   scope: ['read:user', 'user:email'],
   *   authUrl: 'https://github.com/login/oauth/authorize',
   *   tokenUrl: 'https://github.com/login/oauth/access_token'
   * });
   *
   * provider.initiateFlow(); // Redirects to GitHub
   * ```
   */
  initiateFlow(): void {
    const state = this.generateState();
    localStorage.setItem("oauth_state", state);

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope.join(" "),
      state,
      response_type: "code",
    });

    window.location.href = `${this.config.authUrl}?${params.toString()}`;
  }

  /**
   * Complete OAuth flow after redirect from provider
   *
   * @param credentials - Authorization code and state from provider
   * @returns Authentication result with token and user info
   *
   * @example
   * ```ts
   * // In your OAuth callback page:
   * const params = new URLSearchParams(window.location.search);
   * const code = params.get('code');
   * const state = params.get('state');
   *
   * const result = await provider.authenticate({
   *   provider: 'github',
   *   code,
   *   state,
   *   redirectUri: 'http://localhost:3000/auth/callback'
   * });
   * ```
   */
  async authenticate(credentials: OAuthCredentials): Promise<AuthResult> {
    // Verify state to prevent CSRF
    const savedState = localStorage.getItem("oauth_state");
    if (credentials.state !== savedState) {
      throw new Error("OAuth state mismatch - possible CSRF attack");
    }
    localStorage.removeItem("oauth_state");

    // Exchange authorization code for access token via backend
    const response = await apiClient.post<AuthResult>("/api/auth/oauth/callback", {
      provider: credentials.provider,
      code: credentials.code,
      redirectUri: credentials.redirectUri,
    });

    return response;
  }

  /**
   * Check if OAuth provider is properly configured
   */
  isAvailable(): boolean {
    return !!(
      this.config.clientId &&
      this.config.redirectUri &&
      this.config.authUrl &&
      this.config.tokenUrl
    );
  }

  /**
   * Generate random state for CSRF protection
   */
  private generateState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
}
