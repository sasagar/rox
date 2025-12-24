/**
 * Custom error class for API errors with additional context
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public isNetworkError: boolean = false,
    public isTimeout: boolean = false,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * API Client for communicating with Rox backend
 * Provides type-safe HTTP methods with automatic token authentication
 */
export class ApiClient {
  private baseUrl: string;
  private token: string | null = null;
  private defaultTimeout: number = 30000; // 30 seconds

  /**
   * Create new API client instance
   *
   * @param baseUrl - Base URL of the API server (default: 'http://localhost:3000')
   */
  constructor(baseUrl: string = "http://localhost:3000") {
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
   * Make HTTP request with automatic authentication and timeout
   *
   * @param path - API endpoint path (e.g., '/api/users/@me')
   * @param options - Fetch options
   * @param timeout - Request timeout in milliseconds (default: 30000)
   * @returns Parsed JSON response
   * @throws ApiError if response is not ok or network error occurs
   *
   * @private
   */
  private async request<T>(
    path: string,
    options?: RequestInit,
    timeout: number = this.defaultTimeout,
  ): Promise<T> {
    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string>),
    };

    if (this.token) {
      (headers as Record<string, string>).Authorization = `Bearer ${this.token}`;
    }

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new ApiError(
          error.error || `API Error: ${response.statusText}`,
          response.status,
          false,
          false,
        );
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      // Handle abort/timeout
      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError("Request timeout. Please try again.", undefined, false, true);
      }

      // Handle network errors
      if (error instanceof TypeError) {
        throw new ApiError("Network error. Please check your connection.", undefined, true, false);
      }

      // Re-throw ApiError as-is
      if (error instanceof ApiError) {
        throw error;
      }

      // Handle unknown errors
      throw new ApiError(
        error instanceof Error ? error.message : "Unknown error occurred",
        undefined,
        false,
        false,
      );
    }
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
    return this.request<T>(path, { method: "GET" });
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
      method: "POST",
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
      method: "PATCH",
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
  async delete<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  /**
   * Upload file via FormData
   *
   * @param path - API endpoint path
   * @param formData - FormData containing the file
   * @param timeout - Request timeout in milliseconds (default: 60000 for uploads)
   * @returns Parsed JSON response
   *
   * @example
   * ```ts
   * const formData = new FormData();
   * formData.append('file', file);
   * const result = await apiClient.upload<{ url: string }>('/api/upload', formData);
   * ```
   */
  async upload<T>(path: string, formData: FormData, timeout: number = 60000): Promise<T> {
    const headers: Record<string, string> = {};
    // Don't set Content-Type - browser will set it with boundary for multipart/form-data

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        headers,
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        throw new ApiError(
          error.error || `API Error: ${response.statusText}`,
          response.status,
          false,
          false,
        );
      }

      return response.json();
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === "AbortError") {
        throw new ApiError("Upload timeout. Please try again.", undefined, false, true);
      }

      if (error instanceof TypeError) {
        throw new ApiError("Network error. Please check your connection.", undefined, true, false);
      }

      if (error instanceof ApiError) {
        throw error;
      }

      throw new ApiError(
        error instanceof Error ? error.message : "Unknown error occurred",
        undefined,
        false,
        false,
      );
    }
  }
}

/**
 * Default API client instance
 * In development, uses proxy configured in waku.config.ts to forward /api requests to backend
 * In production, uses same origin (browser) or internal Docker network (SSR)
 */
export const apiClient = new ApiClient(
  typeof window !== "undefined"
    ? window.location.origin // Browser: Use same origin (proxy handles routing in dev)
    : process.env.INTERNAL_API_URL || "http://localhost:3000", // SSR: Use internal Docker network or localhost
);
