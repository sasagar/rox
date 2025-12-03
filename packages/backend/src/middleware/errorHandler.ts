/**
 * Error Handling Middleware
 *
 * Catches application-wide errors and returns appropriate responses.
 *
 * @module middleware/errorHandler
 */
import type { Context, Next } from "hono";
import { HTTPException } from "hono/http-exception";

/**
 * Global Error Handler
 *
 * Catches all errors and converts them to appropriate HTTP responses.
 * HTTPException is handled by Hono, other errors are returned as 500 errors.
 *
 * @param c - Hono context
 * @param next - Next middleware/handler
 *
 * @remarks
 * - HTTPException: Delegated to Hono's default handler (re-thrown)
 * - Other errors: Returned as 500 Internal Server Error
 * - Production environment: Error message replaced with "Internal server error"
 * - Development environment: Returns original error message and stack trace
 *
 * @example
 * ```typescript
 * app.use('*', errorHandler);
 * ```
 */
export async function errorHandler(c: Context, next: Next) {
  try {
    return await next();
  } catch (error) {
    // HTTPExceptionはそのままスロー
    if (error instanceof HTTPException) {
      throw error;
    }

    // その他のエラーはログに記録して500エラーを返す
    console.error("Unhandled error:", error);

    return c.json(
      {
        error: {
          message:
            process.env.NODE_ENV === "production"
              ? "Internal server error"
              : (error as Error).message,
          stack: process.env.NODE_ENV === "development" ? (error as Error).stack : undefined,
        },
      },
      500,
    );
  }
}
