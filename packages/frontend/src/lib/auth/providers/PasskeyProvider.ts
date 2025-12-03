import type { IAuthProvider, AuthResult, PasskeyConfig } from "../types";
import { apiClient } from "../../api/client";

/**
 * Passkey (WebAuthn) authentication provider
 * Provides passwordless authentication using FIDO2/WebAuthn
 */
export class PasskeyProvider implements IAuthProvider {
  readonly method = "passkey" as const;
  private config: PasskeyConfig;

  constructor(config: PasskeyConfig) {
    this.config = config;
  }

  /**
   * Register a new passkey for the user
   *
   * @param username - Username to register passkey for
   * @returns Registration result
   *
   * @example
   * ```ts
   * const provider = new PasskeyProvider({
   *   rpId: 'example.com',
   *   rpName: 'Rox',
   *   userVerification: 'preferred',
   *   attestation: 'none'
   * });
   *
   * await provider.register('john');
   * ```
   */
  async register(username: string): Promise<void> {
    // Request registration challenge from server
    const challenge = await apiClient.post<{
      challenge: string;
      userId: string;
    }>("/api/auth/passkey/register/begin", { username });

    // Create WebAuthn credential
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: this.base64ToBuffer(challenge.challenge),
        rp: {
          id: this.config.rpId,
          name: this.config.rpName,
        },
        user: {
          id: this.stringToBuffer(challenge.userId),
          name: username,
          displayName: username,
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 }, // ES256
          { type: "public-key", alg: -257 }, // RS256
        ],
        authenticatorSelection: {
          authenticatorAttachment: "platform", // Prefer platform authenticators (Touch ID, Windows Hello)
          userVerification: this.config.userVerification,
          requireResidentKey: true,
        },
        attestation: this.config.attestation,
        timeout: 60000,
      },
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error("Failed to create passkey");
    }

    // Send credential to server for verification and storage
    await apiClient.post("/api/auth/passkey/register/finish", {
      username,
      credential: this.credentialToJSON(credential),
    });
  }

  /**
   * Authenticate user with existing passkey
   *
   * @param username - Optional username hint
   * @returns Authentication result with token and user info
   *
   * @example
   * ```ts
   * // Authenticate with username hint
   * const result = await provider.authenticate('john');
   *
   * // Or let user select from available passkeys
   * const result = await provider.authenticate();
   * ```
   */
  async authenticate(username?: string): Promise<AuthResult> {
    // Request authentication challenge from server
    const challenge = await apiClient.post<{
      challenge: string;
      allowCredentials?: Array<{ id: string; type: "public-key" }>;
    }>("/api/auth/passkey/authenticate/begin", username ? { username } : {});

    // Get WebAuthn assertion
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge: this.base64ToBuffer(challenge.challenge),
        rpId: this.config.rpId,
        allowCredentials: challenge.allowCredentials?.map((cred) => ({
          id: this.base64ToBuffer(cred.id),
          type: cred.type,
        })),
        userVerification: this.config.userVerification,
        timeout: 60000,
      },
    })) as PublicKeyCredential;

    if (!assertion) {
      throw new Error("Passkey authentication failed");
    }

    // Send assertion to server for verification
    const response = await apiClient.post<AuthResult>("/api/auth/passkey/authenticate/finish", {
      credential: this.credentialToJSON(assertion),
    });

    return response;
  }

  /**
   * Check if WebAuthn is available in this browser
   */
  isAvailable(): boolean {
    return !!(
      window.PublicKeyCredential &&
      navigator.credentials &&
      typeof navigator.credentials.create === "function"
    );
  }

  /**
   * Check if platform authenticator (Touch ID, Windows Hello) is available
   */
  async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }

  // Helper methods for WebAuthn data conversion

  private base64ToBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private stringToBuffer(str: string): ArrayBuffer {
    return new TextEncoder().encode(str).buffer;
  }

  private bufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i] ?? 0);
    }
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }

  private credentialToJSON(credential: PublicKeyCredential): any {
    const response = credential.response as
      | AuthenticatorAttestationResponse
      | AuthenticatorAssertionResponse;

    const base: any = {
      id: credential.id,
      rawId: this.bufferToBase64(credential.rawId),
      type: credential.type,
    };

    if ("attestationObject" in response) {
      // Registration response
      base.response = {
        clientDataJSON: this.bufferToBase64(response.clientDataJSON),
        attestationObject: this.bufferToBase64(response.attestationObject),
      };
    } else {
      // Authentication response
      base.response = {
        clientDataJSON: this.bufferToBase64(response.clientDataJSON),
        authenticatorData: this.bufferToBase64(response.authenticatorData),
        signature: this.bufferToBase64(response.signature),
        userHandle: response.userHandle ? this.bufferToBase64(response.userHandle) : null,
      };
    }

    return base;
  }
}
