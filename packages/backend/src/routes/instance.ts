/**
 * Instance Routes
 *
 * Public API endpoints for instance information.
 * These endpoints do not require authentication.
 *
 * @module routes/instance
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { InstanceSettingsService } from "../services/InstanceSettingsService.js";
import type { RemoteInstanceService } from "../services/RemoteInstanceService.js";

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
app.get("/", async (c: Context) => {
  const instanceSettingsRepository = c.get("instanceSettingsRepository");
  const instanceSettingsService = new InstanceSettingsService(instanceSettingsRepository);

  const info = await instanceSettingsService.getPublicInstanceInfo();

  // Get instance URL from environment
  const instanceUrl = process.env.URL || "http://localhost:3000";

  return c.json({
    // Instance metadata
    name: info.name,
    description: info.description,
    url: instanceUrl,
    maintainerEmail: info.maintainerEmail || null,
    iconUrl: info.iconUrl,
    bannerUrl: info.bannerUrl,
    faviconUrl: info.faviconUrl,

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
      name: "rox",
      version: process.env.npm_package_version || "0.1.0",
      repository: "https://github.com/Love-rox/rox",
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
app.get("/theme", async (c: Context) => {
  const instanceSettingsRepository = c.get("instanceSettingsRepository");
  const instanceSettingsService = new InstanceSettingsService(instanceSettingsRepository);

  const theme = await instanceSettingsService.getThemeSettings();

  return c.json({
    primaryColor: theme.primaryColor,
    darkMode: theme.darkMode,
  });
});

/**
 * Get Remote Instance Information
 *
 * GET /api/instance/remote/:host
 *
 * Fetches and caches information about a remote federated server.
 * Returns software name, version, icon URL, theme color, etc.
 */
app.get("/remote/:host", async (c: Context) => {
  const host = c.req.param("host");

  if (!host) {
    return c.json({ error: "Host parameter is required" }, 400);
  }

  // Basic validation - host should not contain protocol or path
  if (host.includes("/") || host.includes(":")) {
    return c.json({ error: "Invalid host format. Provide domain only (e.g., 'misskey.io')" }, 400);
  }

  const remoteInstanceService = c.get("remoteInstanceService") as RemoteInstanceService;
  const instanceInfo = await remoteInstanceService.getInstanceInfo(host);

  if (!instanceInfo) {
    return c.json({ error: "Failed to fetch instance information" }, 404);
  }

  return c.json(instanceInfo);
});

/**
 * Get Remote Instance Information (Batch)
 *
 * POST /api/instance/remote/batch
 *
 * Fetches information for multiple remote servers at once.
 * Useful for timeline views with multiple remote users.
 */
app.post("/remote/batch", async (c: Context) => {
  const body = await c.req.json<{ hosts: string[] }>();

  if (!body.hosts || !Array.isArray(body.hosts)) {
    return c.json({ error: "hosts array is required" }, 400);
  }

  // Limit batch size to prevent abuse
  if (body.hosts.length > 50) {
    return c.json({ error: "Maximum 50 hosts per batch request" }, 400);
  }

  // Validate hosts
  const validHosts = body.hosts.filter(
    (host) => typeof host === "string" && !host.includes("/") && !host.includes(":"),
  );

  if (validHosts.length === 0) {
    return c.json({ error: "No valid hosts provided" }, 400);
  }

  const remoteInstanceService = c.get("remoteInstanceService") as RemoteInstanceService;
  const instanceInfoMap = await remoteInstanceService.getInstanceInfoBatch(validHosts);

  // Convert Map to object for JSON response
  const result: Record<string, unknown> = {};
  for (const [host, info] of instanceInfoMap) {
    result[host] = info;
  }

  return c.json(result);
});

export default app;
