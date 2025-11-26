/**
 * Instance Routes
 *
 * Public API endpoints for instance information.
 * These endpoints do not require authentication.
 *
 * @module routes/instance
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { InstanceSettingsService } from '../services/InstanceSettingsService.js';

const app = new Hono();

/**
 * Get Public Instance Information
 *
 * GET /api/instance
 *
 * Returns public information about this instance including:
 * - Instance name and description
 * - Registration status
 * - Theme settings
 * - Links to ToS and Privacy Policy
 */
app.get('/', async (c: Context) => {
  const instanceSettingsRepository = c.get('instanceSettingsRepository');
  const instanceSettingsService = new InstanceSettingsService(instanceSettingsRepository);

  const info = await instanceSettingsService.getPublicInstanceInfo();

  // Get instance URL from environment
  const instanceUrl = process.env.URL || 'http://localhost:3000';

  return c.json({
    // Instance metadata
    name: info.name,
    description: info.description,
    url: instanceUrl,
    maintainerEmail: info.maintainerEmail || null,
    iconUrl: info.iconUrl,
    bannerUrl: info.bannerUrl,

    // Legal links
    tosUrl: info.tosUrl,
    privacyPolicyUrl: info.privacyPolicyUrl,

    // Registration settings
    registration: {
      enabled: info.registrationEnabled,
      inviteOnly: info.inviteOnly,
      approvalRequired: info.approvalRequired,
    },

    // Theme settings
    theme: {
      primaryColor: info.theme.primaryColor,
      darkMode: info.theme.darkMode,
    },

    // Software info
    software: {
      name: 'rox',
      version: process.env.npm_package_version || '0.1.0',
      repository: 'https://github.com/Love-rox/rox',
    },
  });
});

/**
 * Get Instance Theme
 *
 * GET /api/instance/theme
 *
 * Returns only theme settings for CSS customization.
 * This is a lightweight endpoint for frontend theming.
 */
app.get('/theme', async (c: Context) => {
  const instanceSettingsRepository = c.get('instanceSettingsRepository');
  const instanceSettingsService = new InstanceSettingsService(instanceSettingsRepository);

  const theme = await instanceSettingsService.getThemeSettings();

  return c.json({
    primaryColor: theme.primaryColor,
    darkMode: theme.darkMode,
  });
});

export default app;
