/**
 * NodeInfo API Routes
 *
 * Provides server metadata following the NodeInfo 2.1 specification.
 * NodeInfo helps other servers discover information about this instance.
 *
 * @see https://nodeinfo.diaspora.software/schema.html
 * @module routes/ap/nodeinfo
 */

import { Hono } from "hono";
import rootPackageJson from "../../../../../package.json";
import { InstanceSettingsService } from "../../services/InstanceSettingsService.js";
import { logger } from "../../lib/logger.js";

const app = new Hono();

// Get version from root package.json
const ROX_VERSION = rootPackageJson.version;

/**
 * NodeInfo Discovery Endpoint
 *
 * GET /.well-known/nodeinfo
 *
 * Returns links to available NodeInfo schema versions.
 * This is the entry point for NodeInfo discovery.
 */
app.get("/.well-known/nodeinfo", (c) => {
  // Use process.env.URL if available (respects reverse proxy HTTPS)
  // Otherwise fall back to constructing from request
  const baseUrl =
    process.env.URL ||
    (c.req.header("host")
      ? `${c.req.url.split("//")[0]}//${c.req.header("host")}`
      : "http://localhost:3000");

  return c.json({
    links: [
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.1",
        href: `${baseUrl}/nodeinfo/2.1`,
      },
      {
        rel: "http://nodeinfo.diaspora.software/ns/schema/2.0",
        href: `${baseUrl}/nodeinfo/2.0`,
      },
    ],
  });
});

/**
 * NodeInfo 2.1 Endpoint
 *
 * GET /nodeinfo/2.1
 *
 * Returns detailed server metadata in NodeInfo 2.1 format.
 */
app.get("/nodeinfo/2.1", async (c) => {
  const userRepository = c.get("userRepository");
  const noteRepository = c.get("noteRepository");
  const instanceSettingsRepository = c.get("instanceSettingsRepository");

  // Get instance settings
  const instanceSettingsService = new InstanceSettingsService(instanceSettingsRepository);
  const [metadata, registration] = await Promise.all([
    instanceSettingsService.getInstanceMetadata(),
    instanceSettingsService.getRegistrationSettings(),
  ]);

  // Get statistics (with fallback to 0 if repositories don't have count methods)
  let totalUsers = 0;
  let localPosts = 0;

  try {
    // These methods may not exist yet, so we wrap in try-catch
    if (typeof (userRepository as any).countLocal === "function") {
      totalUsers = await (userRepository as any).countLocal();
    }
    if (typeof (noteRepository as any).countLocal === "function") {
      localPosts = await (noteRepository as any).countLocal();
    }
  } catch {
    // Gracefully handle missing count methods
    logger.debug("NodeInfo: Count methods not available, using default values");
  }

  return c.json({
    version: "2.1",
    software: {
      name: "rox",
      version: ROX_VERSION,
      repository: "https://github.com/Love-rox/rox",
      homepage: "https://github.com/Love-rox/rox",
    },
    protocols: ["activitypub"],
    services: {
      inbound: [],
      outbound: [],
    },
    openRegistrations: registration.enabled,
    usage: {
      users: {
        total: totalUsers,
        activeHalfyear: null, // TODO: Implement active user tracking
        activeMonth: null, // TODO: Implement active user tracking
      },
      localPosts,
      localComments: 0, // Rox doesn't distinguish comments from posts
    },
    metadata: {
      nodeName: metadata.name || "Rox Instance",
      nodeDescription: metadata.description || "A lightweight ActivityPub server with Misskey API compatibility",
      maintainer: {
        name: "Administrator",
        email: metadata.maintainerEmail || null,
      },
      langs: ["en", "ja"],
      tosUrl: metadata.tosUrl || null,
      privacyPolicyUrl: metadata.privacyPolicyUrl || null,
      iconUrl: metadata.iconUrl || null,
      features: ["activitypub", "misskey_api", "notes", "reactions", "following"],
    },
  });
});

/**
 * NodeInfo 2.0 Endpoint (Legacy Support)
 *
 * GET /nodeinfo/2.0
 *
 * Returns server metadata in NodeInfo 2.0 format (legacy compatibility).
 * This is a simplified version without the 2.1-specific fields.
 */
app.get("/nodeinfo/2.0", async (c) => {
  const userRepository = c.get("userRepository");
  const noteRepository = c.get("noteRepository");
  const instanceSettingsRepository = c.get("instanceSettingsRepository");

  // Get instance settings
  const instanceSettingsService = new InstanceSettingsService(instanceSettingsRepository);
  const [metadata, registration] = await Promise.all([
    instanceSettingsService.getInstanceMetadata(),
    instanceSettingsService.getRegistrationSettings(),
  ]);

  // Get statistics (with fallback to 0 if repositories don't have count methods)
  let totalUsers = 0;
  let localPosts = 0;

  try {
    // These methods may not exist yet, so we wrap in try-catch
    if (typeof (userRepository as any).countLocal === "function") {
      totalUsers = await (userRepository as any).countLocal();
    }
    if (typeof (noteRepository as any).countLocal === "function") {
      localPosts = await (noteRepository as any).countLocal();
    }
  } catch {
    // Gracefully handle missing count methods
    logger.debug("NodeInfo: Count methods not available, using default values");
  }

  return c.json({
    version: "2.0",
    software: {
      name: "rox",
      version: ROX_VERSION,
    },
    protocols: ["activitypub"],
    services: {
      inbound: [],
      outbound: [],
    },
    openRegistrations: registration.enabled,
    usage: {
      users: {
        total: totalUsers,
      },
      localPosts,
    },
    metadata: {
      nodeName: metadata.name || "Rox Instance",
      nodeDescription: metadata.description || "A lightweight ActivityPub server with Misskey API compatibility",
      maintainer: {
        name: "Administrator",
        email: metadata.maintainerEmail || null,
      },
      langs: ["en", "ja"],
      tosUrl: metadata.tosUrl || null,
      privacyPolicyUrl: metadata.privacyPolicyUrl || null,
      iconUrl: metadata.iconUrl || null,
      features: ["activitypub", "misskey_api", "notes", "reactions", "following"],
    },
  });
});

export default app;
