/**
 * Authentication library exports
 * Provides flexible authentication with support for Password, OAuth, and Passkey
 */

// Core manager
export { AuthManager, authManager } from "./AuthManager";

// Providers
export { PasswordAuthProvider } from "./providers/PasswordAuthProvider";
export { OAuthProvider } from "./providers/OAuthProvider";
export { PasskeyProvider } from "./providers/PasskeyProvider";

// Types
export type {
  AuthMethod,
  OAuthProvider as OAuthProviderType,
  AuthResult,
  PasswordCredentials,
  OAuthCredentials,
  PasskeyCredentials,
  IAuthProvider,
  OAuthConfig,
  PasskeyConfig,
} from "./types";
