/**
 * Remote Fetch Service
 *
 * Provides robust HTTP fetching for remote ActivityPub objects with:
 * - Retry logic with exponential backoff
 * - Configurable timeouts
 * - Rate limit handling (429 responses)
 * - Network error recovery
 * - Detailed error logging
 * - HTTP Signature support for authenticated fetches
 *
 * @module services/ap/RemoteFetchService
 */

import { signRequest, getSignedHeaders } from "../../utils/crypto.js";
import { logger } from "../../lib/logger.js";

/**
 * Signature configuration for authenticated fetches
 */
export interface SignatureConfig {
  /** Key ID (e.g., "https://example.com/users/alice#main-key") */
  keyId: string;
  /** PEM-formatted private key */
  privateKey: string;
}

/**
 * Fetch options configuration
 */
export interface RemoteFetchOptions {
  /** Request timeout in milliseconds (default: 10000ms / 10 seconds) */
  timeout?: number;
  /** Maximum retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial retry delay in milliseconds (default: 1000ms) */
  initialRetryDelay?: number;
  /** Additional headers to include in request */
  headers?: Record<string, string>;
  /** HTTP Signature configuration for authenticated requests */
  signature?: SignatureConfig;
}

/**
 * Fetch result with detailed error information
 */
export interface RemoteFetchResult<T = any> {
  success: boolean;
  data?: T;
  error?: {
    type: "timeout" | "network" | "rate_limit" | "server_error" | "invalid_response";
    message: string;
    statusCode?: number;
    retryAfter?: number;
  };
}

/**
 * Remote Fetch Service
 *
 * Handles HTTP requests to remote ActivityPub servers with comprehensive error handling.
 *
 * @example
 * ```typescript
 * const fetchService = new RemoteFetchService();
 *
 * const result = await fetchService.fetchActivityPubObject(
 *   'https://mastodon.social/users/alice'
 * );
 *
 * if (result.success) {
 *   console.log('Actor:', result.data);
 * } else {
 *   console.error('Fetch failed:', result.error);
 * }
 * ```
 */
export class RemoteFetchService {
  private static readonly DEFAULT_TIMEOUT = 10000; // 10 seconds
  private static readonly DEFAULT_MAX_RETRIES = 3;
  private static readonly DEFAULT_INITIAL_RETRY_DELAY = 1000; // 1 second
  private static readonly ACTIVITYPUB_HEADERS = {
    Accept: "application/activity+json, application/ld+json",
    "User-Agent": "Rox/1.0 (ActivityPub)",
  };

  /**
   * Fetch ActivityPub object from remote server
   *
   * Performs HTTP GET with ActivityPub content negotiation headers,
   * automatic retries, and comprehensive error handling.
   *
   * @param url - Remote object URL
   * @param options - Fetch options
   * @returns Fetch result with data or error
   */
  async fetchActivityPubObject<T = any>(
    url: string,
    options: RemoteFetchOptions = {},
  ): Promise<RemoteFetchResult<T>> {
    const {
      timeout = RemoteFetchService.DEFAULT_TIMEOUT,
      maxRetries = RemoteFetchService.DEFAULT_MAX_RETRIES,
      initialRetryDelay = RemoteFetchService.DEFAULT_INITIAL_RETRY_DELAY,
      headers = {},
      signature,
    } = options;

    let lastError: RemoteFetchResult<T>["error"];
    let retryDelay = initialRetryDelay;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug({ url, attempt: attempt + 1, maxRetries: maxRetries + 1, signed: !!signature }, "Fetching remote object");

        // Build request headers
        let requestHeaders: Record<string, string> = {
          ...RemoteFetchService.ACTIVITYPUB_HEADERS,
          ...headers,
        };

        // Add HTTP Signature if configured
        if (signature) {
          const signedHeaders = getSignedHeaders(url, null);
          const signatureHeader = signRequest(
            signature.privateKey,
            signature.keyId,
            "GET",
            url,
            null,
          );
          requestHeaders = {
            ...requestHeaders,
            ...signedHeaders,
            Signature: signatureHeader,
          };
        }

        const result = await this.performFetch<T>(url, timeout, requestHeaders);

        if (result.success) {
          return result;
        }

        lastError = result.error;

        // Don't retry on certain errors
        if (
          result.error?.type === "invalid_response" ||
          (result.error?.statusCode &&
            result.error.statusCode >= 400 &&
            result.error.statusCode < 500 &&
            result.error.statusCode !== 429)
        ) {
          logger.debug({ url, error: result.error }, "Non-retryable error");
          return result;
        }

        // Handle rate limiting
        if (result.error?.type === "rate_limit" && result.error.retryAfter) {
          retryDelay = result.error.retryAfter * 1000; // Convert to milliseconds
          logger.debug({ url, retryDelayMs: retryDelay }, "Rate limited, waiting before retry");
        }

        // Don't wait after the last attempt
        if (attempt < maxRetries) {
          logger.debug({ url, retryDelayMs: retryDelay }, "Waiting before retry");
          await this.sleep(retryDelay);
          retryDelay *= 2; // Exponential backoff
        }
      } catch (error) {
        // Unexpected error (should not happen due to try/catch in performFetch)
        logger.error({ err: error, url }, "Unexpected error fetching remote object");
        lastError = {
          type: "network",
          message: error instanceof Error ? error.message : "Unknown error",
        };
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: lastError || {
        type: "network",
        message: "Max retries exceeded",
      },
    };
  }

  /**
   * Perform single fetch attempt with timeout
   *
   * @param url - URL to fetch
   * @param timeout - Timeout in milliseconds
   * @param headers - HTTP headers
   * @returns Fetch result
   *
   * @private
   */
  private async performFetch<T>(
    url: string,
    timeout: number,
    headers: Record<string, string>,
  ): Promise<RemoteFetchResult<T>> {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      let response: Response;
      try {
        response = await fetch(url, {
          headers,
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // Handle HTTP errors
      if (!response.ok) {
        // Rate limiting
        if (response.status === 429) {
          const retryAfter = parseInt(response.headers.get("Retry-After") || "60", 10);
          return {
            success: false,
            error: {
              type: "rate_limit",
              message: "Rate limited by remote server",
              statusCode: 429,
              retryAfter,
            },
          };
        }

        // Server errors (5xx) - retryable
        if (response.status >= 500) {
          return {
            success: false,
            error: {
              type: "server_error",
              message: `Server error: ${response.status} ${response.statusText}`,
              statusCode: response.status,
            },
          };
        }

        // Client errors (4xx) - not retryable (except 429)
        return {
          success: false,
          error: {
            type: "invalid_response",
            message: `HTTP error: ${response.status} ${response.statusText}`,
            statusCode: response.status,
          },
        };
      }

      // Parse JSON response
      let data: T;
      try {
        data = (await response.json()) as T;
      } catch {
        return {
          success: false,
          error: {
            type: "invalid_response",
            message: "Failed to parse JSON response",
            statusCode: response.status,
          },
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      // Timeout or network error
      if (error instanceof Error && error.name === "AbortError") {
        return {
          success: false,
          error: {
            type: "timeout",
            message: `Request timeout after ${timeout}ms`,
          },
        };
      }

      // Network error
      return {
        success: false,
        error: {
          type: "network",
          message: error instanceof Error ? error.message : "Network error",
        },
      };
    }
  }

  /**
   * Sleep utility for retry delays
   *
   * @param ms - Milliseconds to sleep
   * @returns Promise that resolves after delay
   *
   * @private
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
