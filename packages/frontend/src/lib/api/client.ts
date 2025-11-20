/**
 * API Client for communicating with Rox backend
 * Provides type-safe HTTP methods with automatic token authentication
 */
export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  /**
   * Create new API client instance
   *
   * @param baseUrl - Base URL of the API server (default: 'http://localhost:3000')
   */
  constructor(baseUrl: string = 'http://localhost:3000') {
    this.baseUrl = baseUrl;
  }

  /**
   * Set authentication token for subsequent requests
   *
   * @param token - Bearer token or null to clear authentication
   *
   * @example
   * ```ts
   * apiClient.setToken('your-auth-token');
   * // Future requests will include: Authorization: Bearer your-auth-token
   * ```
   */
  setToken(token: string | null) {
    this.token = token;
  }

  /**
   * Make HTTP request with automatic authentication
   *
   * @param path - API endpoint path (e.g., '/api/users/@me')
   * @param options - Fetch options
   * @returns Parsed JSON response
   * @throws Error if response is not ok
   *
   * @private
   */
  private async request<T>(
    path: string,
    options?: RequestInit
  ): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    if (this.token) {
      (headers as Record<string, string>).Authorization = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(error.error || `API Error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Perform GET request
   *
   * @param path - API endpoint path
   * @returns Parsed JSON response
   *
   * @example
   * ```ts
   * const user = await apiClient.get<User>('/api/users/@me');
   * ```
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'GET' });
  }

  /**
   * Perform POST request
   *
   * @param path - API endpoint path
   * @param data - Request body data (will be JSON stringified)
   * @returns Parsed JSON response
   *
   * @example
   * ```ts
   * const note = await apiClient.post<Note>('/api/notes/create', {
   *   text: 'Hello, world!'
   * });
   * ```
   */
  async post<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Perform PATCH request
   *
   * @param path - API endpoint path
   * @param data - Request body data (will be JSON stringified)
   * @returns Parsed JSON response
   *
   * @example
   * ```ts
   * const user = await apiClient.patch<User>('/api/i/update', {
   *   name: 'New Name'
   * });
   * ```
   */
  async patch<T>(path: string, data?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  /**
   * Perform DELETE request
   *
   * @param path - API endpoint path
   * @returns Parsed JSON response
   *
   * @example
   * ```ts
   * await apiClient.delete<{ success: boolean }>('/api/notes/delete', {
   *   noteId: '123'
   * });
   * ```
   */
  async delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

/**
 * Default API client instance
 * Automatically points to backend server (port 3000) when running in Vite dev server (port 5173)
 */
export const apiClient = new ApiClient(
  typeof window !== 'undefined'
    ? window.location.origin.replace(':5173', ':3000') // Vite dev server -> backend
    : 'http://localhost:3000'
);
