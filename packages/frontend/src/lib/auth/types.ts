/**
 * Authentication types and interfaces
 * Supports multiple authentication methods: Password, OAuth, Passkey
 */

import type { AuthResult as UserAuthResult } from "../types/user";

/**
 * Authentication method types
 */
export type AuthMethod = "password" | "oauth" | "passkey";

/**
 * OAuth provider types
 */
export type OAuthProvider = "github" | "google" | "discord" | "mastodon";

/**
 * Base authentication result
 */
export type AuthResult = UserAuthResult;

/**
 * Password authentication credentials
 */
export interface PasswordCredentials {
  username: string;
  password: string;
}

/**
 * OAuth authentication data
 */
export interface OAuthCredentials {
  provider: OAuthProvider;
  code: string;
  state?: string;
  redirectUri: string;
}

/**
 * Passkey (WebAuthn) authentication data
 */
export interface PasskeyCredentials {
  /** WebAuthn credential ID */
  credentialId: string;
  /** Client data JSON */
  clientDataJSON: string;
  /** Authenticator data */
  authenticatorData: string;
  /** Signature */
  signature: string;
  /** User handle (optional) */
  userHandle?: string;
}

/**
 * Passkey registration data
 */
export interface PasskeyRegistrationData {
  /** WebAuthn credential */
  credential: PublicKeyCredential;
  /** Username for registration */
  username: string;
}

/**
 * Abstract authentication provider interface
 * Allows different authentication methods to be plugged in
 */
export interface IAuthProvider {
  /** Authentication method identifier */
  readonly method: AuthMethod;

  /**
   * Authenticate user with this provider
   * @returns Authentication result with token and user info
   */
  authenticate(...args: any[]): Promise<AuthResult>;

  /**
   * Check if this provider is available/configured
   * @returns true if provider can be used
   */
  isAvailable(): boolean;
}

/**
 * OAuth provider configuration
 */
export interface OAuthConfig {
  provider: OAuthProvider;
  clientId: string;
  redirectUri: string;
  scope: string[];
  /** Authorization endpoint URL */
  authUrl: string;
  /** Token exchange endpoint URL */
  tokenUrl: string;
}

/**
 * Passkey (WebAuthn) configuration
 */
export interface PasskeyConfig {
  /** Relying Party ID (usually domain) */
  rpId: string;
  /** Relying Party name */
  rpName: string;
  /** User verification requirement */
  userVerification: "required" | "preferred" | "discouraged";
  /** Attestation conveyance preference */
  attestation: "none" | "indirect" | "direct";
}
