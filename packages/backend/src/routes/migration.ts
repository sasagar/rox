/**
 * Migration Routes
 *
 * API endpoints for account migration management.
 * Allows users to manage aliases and initiate account transfers.
 *
 * @module routes/migration
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { MigrationService } from '../services/MigrationService.js';

const app = new Hono();

/**
 * Get Migration Status
 *
 * GET /api/i/migration
 *
 * Returns the current migration status including aliases,
 * movedTo, and whether migration is allowed.
 *
 * Requires authentication.
 */
app.get('/', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const migrationService = c.get('migrationService') as MigrationService;

  try {
    const status = await migrationService.getMigrationStatus(user.id);
    return c.json(status);
  } catch (error) {
    console.error('Failed to get migration status:', error);
    return c.json({ error: 'Failed to get migration status' }, 500);
  }
});

/**
 * List Aliases
 *
 * GET /api/i/migration/aliases
 *
 * Returns the list of account aliases (alsoKnownAs).
 *
 * Requires authentication.
 */
app.get('/aliases', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const migrationService = c.get('migrationService') as MigrationService;

  try {
    const aliases = await migrationService.getAliases(user.id);
    return c.json({ aliases });
  } catch (error) {
    console.error('Failed to get aliases:', error);
    return c.json({ error: 'Failed to get aliases' }, 500);
  }
});

/**
 * Add Alias
 *
 * POST /api/i/migration/aliases
 *
 * Adds a new alias to the user's account.
 *
 * Body: { uri: string }
 *
 * Requires authentication.
 */
app.post('/aliases', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const migrationService = c.get('migrationService') as MigrationService;

  try {
    const body = await c.req.json<{ uri?: string }>();

    if (!body.uri || typeof body.uri !== 'string') {
      return c.json({ error: 'URI is required' }, 400);
    }

    const aliases = await migrationService.addAlias(user.id, body.uri.trim());
    return c.json({ aliases }, 201);
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    console.error('Failed to add alias:', error);
    return c.json({ error: 'Failed to add alias' }, 500);
  }
});

/**
 * Remove Alias
 *
 * DELETE /api/i/migration/aliases
 *
 * Removes an alias from the user's account.
 *
 * Body: { uri: string }
 *
 * Requires authentication.
 */
app.delete('/aliases', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const migrationService = c.get('migrationService') as MigrationService;

  try {
    const body = await c.req.json<{ uri?: string }>();

    if (!body.uri || typeof body.uri !== 'string') {
      return c.json({ error: 'URI is required' }, 400);
    }

    const aliases = await migrationService.removeAlias(user.id, body.uri.trim());
    return c.json({ aliases });
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    console.error('Failed to remove alias:', error);
    return c.json({ error: 'Failed to remove alias' }, 500);
  }
});

/**
 * Validate Migration
 *
 * POST /api/i/migration/validate
 *
 * Validates whether migration to a target account is possible.
 * Checks bi-directional alsoKnownAs and cooldown period.
 *
 * Body: { targetUri: string }
 *
 * Requires authentication.
 */
app.post('/validate', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const migrationService = c.get('migrationService') as MigrationService;

  try {
    const body = await c.req.json<{ targetUri?: string }>();

    if (!body.targetUri || typeof body.targetUri !== 'string') {
      return c.json({ error: 'Target URI is required' }, 400);
    }

    const result = await migrationService.validateMigration(user.id, body.targetUri.trim());
    return c.json(result);
  } catch (error) {
    console.error('Failed to validate migration:', error);
    return c.json({ error: 'Failed to validate migration' }, 500);
  }
});

/**
 * Initiate Migration
 *
 * POST /api/i/migration/initiate
 *
 * Initiates account migration to a target account.
 * Sends Move activity to all followers and sets movedTo.
 *
 * WARNING: This action is irreversible for 30 days.
 *
 * Body: { targetUri: string }
 *
 * Requires authentication.
 */
app.post('/initiate', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const migrationService = c.get('migrationService') as MigrationService;

  try {
    const body = await c.req.json<{ targetUri?: string }>();

    if (!body.targetUri || typeof body.targetUri !== 'string') {
      return c.json({ error: 'Target URI is required' }, 400);
    }

    const result = await migrationService.initiateMigration(user.id, body.targetUri.trim());

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    return c.json(result);
  } catch (error) {
    console.error('Failed to initiate migration:', error);
    return c.json({ error: 'Failed to initiate migration' }, 500);
  }
});

/**
 * Check Migration Eligibility
 *
 * GET /api/i/migration/can-migrate
 *
 * Checks if the user is currently eligible to migrate
 * (not in cooldown period, not already migrated).
 *
 * Requires authentication.
 */
app.get('/can-migrate', async (c: Context) => {
  const user = c.get('user');
  if (!user) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const migrationService = c.get('migrationService') as MigrationService;

  try {
    const result = await migrationService.canMigrate(user.id);
    return c.json(result);
  } catch (error) {
    console.error('Failed to check migration eligibility:', error);
    return c.json({ error: 'Failed to check migration eligibility' }, 500);
  }
});

export default app;
