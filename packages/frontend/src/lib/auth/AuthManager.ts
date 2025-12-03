import type { IAuthProvider, AuthMethod, AuthResult } from "./types";
import { PasswordAuthProvider } from "./providers/PasswordAuthProvider";
import { PasskeyProvider } from "./providers/PasskeyProvider";

/**
 * Central authentication manager
 * Manages multiple authentication providers and coordinates authentication flow
 */
export class AuthManager {
  private providers: Map<AuthMethod, IAuthProvider> = new Map();

  constructor() {
    // Register default password provider
    this.registerProvider(new PasswordAuthProvider());

    // Register passkey provider with dynamic rpId from current hostname
    // Only register if we're in a browser environment
    if (typeof window !== "undefined") {
      this.registerProvider(
        new PasskeyProvider({
          rpId: window.location.hostname,
          rpName: "Rox",
          userVerification: "preferred",
          attestation: "none",
        }),
      );
    }
  }

  /**
   * Register an authentication provider
   *
   * @param provider - Authentication provider to register
   *
   * @example
   * ```ts
   * const authManager = new AuthManager();
   *
   * // Register OAuth provider for GitHub
   * authManager.registerProvider(new OAuthProvider({
   *   provider: 'github',
   *   clientId: process.env.GITHUB_CLIENT_ID,
   *   redirectUri: 'http://localhost:3000/auth/callback/github',
   *   scope: ['read:user', 'user:email'],
   *   authUrl: 'https://github.com/login/oauth/authorize',
   *   tokenUrl: 'https://github.com/login/oauth/access_token'
   * }));
   *
   * // Register Passkey provider
   * authManager.registerProvider(new PasskeyProvider({
   *   rpId: 'localhost',
   *   rpName: 'Rox',
   *   userVerification: 'preferred',
   *   attestation: 'none'
   * }));
   * ```
   */
  registerProvider(provider: IAuthProvider): void {
    this.providers.set(provider.method, provider);
  }

  /**
   * Get a specific authentication provider
   *
   * @param method - Authentication method
   * @returns Provider instance or undefined
   */
  getProvider<T extends IAuthProvider>(method: AuthMethod): T | undefined {
    return this.providers.get(method) as T | undefined;
  }

  /**
   * Get all available authentication providers
   *
   * @returns Array of available providers
   */
  getAvailableProviders(): IAuthProvider[] {
    return Array.from(this.providers.values()).filter((provider) => provider.isAvailable());
  }

  /**
   * Check if a specific authentication method is available
   *
   * @param method - Authentication method to check
   * @returns true if method is available
   */
  isMethodAvailable(method: AuthMethod): boolean {
    const provider = this.providers.get(method);
    return provider ? provider.isAvailable() : false;
  }

  /**
   * Authenticate user with specified method
   *
   * @param method - Authentication method to use
   * @param credentials - Authentication credentials (varies by method)
   * @returns Authentication result
   *
   * @throws Error if provider is not registered or unavailable
   *
   * @example
   * ```ts
   * // Password authentication
   * const result = await authManager.authenticate('password', {
   *   username: 'john',
   *   password: 'secret123'
   * });
   *
   * // OAuth authentication
   * const result = await authManager.authenticate('oauth', {
   *   provider: 'github',
   *   code: 'auth_code_from_github',
   *   state: 'csrf_token',
   *   redirectUri: 'http://localhost:3000/auth/callback/github'
   * });
   *
   * // Passkey authentication
   * const result = await authManager.authenticate('passkey', 'john');
   * ```
   */
  async authenticate(method: AuthMethod, ...credentials: any[]): Promise<AuthResult> {
    const provider = this.providers.get(method);

    if (!provider) {
      throw new Error(`Authentication provider '${method}' is not registered`);
    }

    if (!provider.isAvailable()) {
      throw new Error(`Authentication provider '${method}' is not available`);
    }

    return provider.authenticate(...credentials);
  }
}

/**
 * Default authentication manager instance
 * Pre-configured with password authentication
 *
 * Additional providers can be registered at application startup:
 * ```ts
 * // In your app initialization
 * if (process.env.GITHUB_CLIENT_ID) {
 *   authManager.registerProvider(new OAuthProvider({ ... }));
 * }
 * ```
 */
export const authManager = new AuthManager();
