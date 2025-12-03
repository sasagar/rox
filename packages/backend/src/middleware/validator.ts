/**
 * Validation Middleware
 *
 * Provides reusable validation middleware using Zod schemas with @hono/zod-validator.
 * Returns structured error responses for validation failures.
 *
 * @module middleware/validator
 */

import { zValidator } from "@hono/zod-validator";
import type { ZodSchema, ZodError } from "zod";
import type { Context } from "hono";

/**
 * Custom error handler for validation failures
 *
 * Returns a consistent error format with field-level details
 */
function createValidationHook() {
  return (
    result: { success: boolean; error?: ZodError; data: unknown },
    c: Context,
  ): Response | undefined => {
    if (!result.success) {
      const errors = result.error!.flatten();

      return c.json(
        {
          error: "Validation failed",
          details: {
            fieldErrors: errors.fieldErrors,
            formErrors: errors.formErrors,
          },
        },
        400,
      );
    }
    // Return undefined to continue to the next middleware
    return undefined;
  };
}

/**
 * JSON body validator middleware
 *
 * Validates request body against a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { validateJson } from '../middleware/validator.js';
 * import { createNoteSchema } from '../lib/validation.js';
 *
 * app.post('/create', requireAuth(), validateJson(createNoteSchema), async (c) => {
 *   const data = c.req.valid('json');
 *   // data is type-safe and validated
 * });
 * ```
 */
export function validateJson<T extends ZodSchema>(schema: T) {
  return zValidator("json", schema, createValidationHook() as any);
}

/**
 * Query parameter validator middleware
 *
 * Validates URL query parameters against a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { validateQuery } from '../middleware/validator.js';
 * import { timelineQuerySchema } from '../lib/validation.js';
 *
 * app.get('/timeline', validateQuery(timelineQuerySchema), async (c) => {
 *   const { limit, sinceId, untilId } = c.req.valid('query');
 *   // parameters are type-safe and validated
 * });
 * ```
 */
export function validateQuery<T extends ZodSchema>(schema: T) {
  return zValidator("query", schema, createValidationHook() as any);
}

/**
 * URL parameter validator middleware
 *
 * Validates URL path parameters against a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { validateParam } from '../middleware/validator.js';
 * import { z } from 'zod';
 *
 * const paramSchema = z.object({ id: z.string().min(1) });
 *
 * app.get('/:id', validateParam(paramSchema), async (c) => {
 *   const { id } = c.req.valid('param');
 * });
 * ```
 */
export function validateParam<T extends ZodSchema>(schema: T) {
  return zValidator("param", schema, createValidationHook() as any);
}

/**
 * Form data validator middleware
 *
 * Validates multipart/form-data against a Zod schema.
 *
 * @param schema - Zod schema to validate against
 * @returns Hono middleware function
 *
 * @example
 * ```typescript
 * import { validateForm } from '../middleware/validator.js';
 * import { z } from 'zod';
 *
 * const formSchema = z.object({ name: z.string() });
 *
 * app.post('/upload', validateForm(formSchema), async (c) => {
 *   const data = c.req.valid('form');
 * });
 * ```
 */
export function validateForm<T extends ZodSchema>(schema: T) {
  return zValidator("form", schema, createValidationHook() as any);
}
