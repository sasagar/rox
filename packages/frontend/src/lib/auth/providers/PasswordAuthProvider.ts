import type { IAuthProvider, AuthResult, PasswordCredentials } from "../types";
import { apiClient } from "../../api/client";

/**
 * Password-based authentication provider
 * Traditional username/password authentication
 */
export class PasswordAuthProvider implements IAuthProvider {
  readonly method = "password" as const;

  /**
   * Authenticate user with username and password
   *
   * @param credentials - Username and password
   * @returns Authentication result with token and user info
   *
   * @example
   * ```ts
   * const provider = new PasswordAuthProvider();
   * const result = await provider.authenticate({
   *   username: 'john',
   *   password: 'secret123'
   * });
   * ```
   */
  async authenticate(credentials: PasswordCredentials): Promise<AuthResult> {
    const response = await apiClient.post<AuthResult>("/api/auth/session", {
      username: credentials.username,
      password: credentials.password,
    });

    return response;
  }

  /**
   * Check if password authentication is available
   * Always returns true as it's the default method
   */
  isAvailable(): boolean {
    return true;
  }
}
