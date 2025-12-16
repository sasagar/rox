// Set process title for top/ps visibility
process.title = "hono-rox";

import { Hono } from "hono";
import { cors } from "hono/cors";
import {
  diMiddleware,
  errorHandler,
  securityHeaders,
  requestLogger,
  metricsMiddleware,
} from "./middleware/index.js";
import { logger } from "./lib/logger.js";
import metricsRoute from "./routes/metrics.js";
import usersRoute from "./routes/users.js";
import authRoute from "./routes/auth.js";
import oauthRoute from "./routes/oauth.js";
import driveRoute from "./routes/drive.js";
import notesRoute from "./routes/notes.js";
import reactionsRoute from "./routes/reactions.js";
import followingRoute from "./routes/following.js";
import actorRoute from "./routes/ap/actor.js";
import webfingerRoute from "./routes/ap/webfinger.js";
import inboxRoute from "./routes/ap/inbox.js";
import outboxRoute from "./routes/ap/outbox.js";
import followersRoute from "./routes/ap/followers.js";
import followingAPRoute from "./routes/ap/following.js";
import noteAPRoute from "./routes/ap/note.js";
import nodeinfoRoute from "./routes/ap/nodeinfo.js";
import proxyRoute from "./routes/proxy.js";
import healthRoute from "./routes/health.js";
import adminRoute from "./routes/admin.js";
import reportsRoute from "./routes/reports.js";
import invitationsRoute from "./routes/invitations.js";
import instanceRoute from "./routes/instance.js";
import startupImageRoute from "./routes/startup-image.js";
import emojisRoute from "./routes/emojis.js";
import migrationRoute from "./routes/migration.js";
import moderatorRoute from "./routes/moderator.js";
import notificationsRoute from "./routes/notifications.js";
import pushRoute from "./routes/push.js";
import scheduledNotesRoute from "./routes/scheduled-notes.js";
import contactRoute from "./routes/contact.js";
import onboardingRoute from "./routes/onboarding.js";
import mentionsRoute from "./routes/mentions.js";
import directRoute from "./routes/direct.js";
import listsRoute from "./routes/lists.js";
import mastodonRoute from "./routes/mastodon.js";
import wsRoute, { websocket } from "./routes/ws.js";
import packageJson from "../../../package.json";
import { ReceivedActivitiesCleanupService } from "./services/ReceivedActivitiesCleanupService.js";
import { RemoteInstanceRefreshService } from "./services/RemoteInstanceRefreshService.js";
import { ScheduledNotePublisher } from "./services/ScheduledNotePublisher.js";
import { ScheduledNoteService } from "./services/ScheduledNoteService.js";
import { NoteService } from "./services/NoteService.js";
import { getContainer } from "./di/container.js";

const app = new Hono();

// Global middleware
app.use("*", metricsMiddleware());
app.use("*", requestLogger());
app.use("*", errorHandler);
app.use("*", securityHeaders());
app.use("*", cors());
app.use("*", diMiddleware());

// Health check and metrics routes
app.route("/health", healthRoute);
app.route("/metrics", metricsRoute);

// ルートエンドポイント
app.get("/", (c) => {
  return c.json({
    name: "Rox API",
    version: packageJson.version,
    description: "Lightweight ActivityPub server with Misskey API compatibility",
  });
});

// APIルート
app.route("/api/users", usersRoute);
app.route("/api/auth", authRoute);
app.route("/api/auth/oauth", oauthRoute);
app.route("/api/drive", driveRoute);
app.route("/api/notes", notesRoute);
app.route("/api/notes/reactions", reactionsRoute);
app.route("/api/following", followingRoute);
app.route("/api/admin", adminRoute);
app.route("/api/mod", moderatorRoute);
app.route("/api/reports", reportsRoute);
app.route("/api/invitations", invitationsRoute);
app.route("/api/instance", instanceRoute);
app.route("/api/startup-image", startupImageRoute);
app.route("/api/emojis", emojisRoute);
app.route("/api/i/migration", migrationRoute);
app.route("/api/notifications", notificationsRoute);
app.route("/api/push", pushRoute);
app.route("/api/scheduled-notes", scheduledNotesRoute);
app.route("/api/contact", contactRoute);
app.route("/api/onboarding", onboardingRoute);
app.route("/api/mentions", mentionsRoute);
app.route("/api/direct", directRoute);
app.route("/api/users/lists", listsRoute);

// Mastodon compatible API
app.route("/api/v1", mastodonRoute);

// WebSocket routes for real-time updates
app.route("/ws", wsRoute);

// Media Proxy (both paths for backward compatibility)
app.route("/api/proxy", proxyRoute);
app.route("/proxy", proxyRoute);

// ActivityPubルート
app.route("/", webfingerRoute); // /.well-known/webfinger
app.route("/", nodeinfoRoute); // /.well-known/nodeinfo, /nodeinfo/*
app.route("/users", actorRoute); // /users/:username
app.route("/", inboxRoute); // /users/:username/inbox
app.route("/users", outboxRoute); // /users/:username/outbox
app.route("/users", followersRoute); // /users/:username/followers
app.route("/users", followingAPRoute); // /users/:username/following
app.route("/", noteAPRoute); // /notes/:id

const port = parseInt(process.env.PORT || "3000", 10);

// Start cleanup service for received activities
const cleanupService = new ReceivedActivitiesCleanupService({
  retentionDays: 7,
  intervalMs: 24 * 60 * 60 * 1000, // 24 hours
});
cleanupService.start();

// Start remote instance refresh service
const container = getContainer();

// Initialize system account on startup
container.systemAccountService.ensureSystemAccount().catch((error) => {
  logger.error({ err: error }, "Failed to initialize system account");
});

const remoteInstanceRefreshService = new RemoteInstanceRefreshService(
  container.remoteInstanceRepository,
  {
    intervalMs: 60 * 60 * 1000, // 1 hour
    staleTTLMs: 24 * 60 * 60 * 1000, // 24 hours
    batchSize: 20,
    maxErrorCount: 5,
  },
);
remoteInstanceRefreshService.start();

// Start scheduled note publisher service
const noteService = new NoteService(
  container.noteRepository,
  container.driveFileRepository,
  container.followRepository,
  container.userRepository,
  container.activityPubDeliveryService,
  container.cacheService,
  container.notificationService,
  container.listRepository,
);
const scheduledNoteService = new ScheduledNoteService(
  container.scheduledNoteRepository,
  container.roleService,
  noteService,
);
const scheduledNotePublisher = new ScheduledNotePublisher(scheduledNoteService, {
  intervalMs: 30 * 1000, // Check every 30 seconds
  batchSize: 50,
});
scheduledNotePublisher.start();

// Print startup banner (plain text for systemd/console compatibility)
const env = process.env.NODE_ENV || "development";
const queueMode = container.activityDeliveryQueue.isQueueEnabled() ? "redis" : "sync";
const cacheMode = container.cacheService.isAvailable() ? "dragonfly" : "disabled";

console.log("══════════════════════════════════════════════════");
console.log(`🦊 Rox v${packageJson.version}`);
console.log("══════════════════════════════════════════════════");
console.log(`Environment:  ${env}`);
console.log(`Port:         ${port}`);
console.log(`URL:          ${process.env.URL || "(not set)"}`);
console.log(`Database:     ${process.env.DB_TYPE || "postgres"}`);
console.log(`Storage:      ${process.env.STORAGE_TYPE || "local"}`);
console.log(`Queue:        ${queueMode}`);
console.log(`Cache:        ${cacheMode}`);
console.log(`System:       @system (server account)`);
console.log("══════════════════════════════════════════════════");

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn({ signal }, "Shutdown already in progress");
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, "Starting graceful shutdown");

  const shutdownTimeout = setTimeout(() => {
    logger.error("Shutdown timeout exceeded, forcing exit");
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Stop accepting new requests (handled by isShuttingDown flag)
    logger.info("Stopping cleanup service");
    cleanupService.stop();

    logger.info("Stopping remote instance refresh service");
    remoteInstanceRefreshService.stop();

    logger.info("Stopping scheduled note publisher");
    scheduledNotePublisher.stop();

    // Shutdown activity delivery queue (drains pending jobs)
    logger.info("Shutting down activity delivery queue");
    await container.activityDeliveryQueue.shutdown();

    logger.info("Graceful shutdown complete");
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, "Error during shutdown");
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

export default {
  port,
  fetch: app.fetch,
  websocket,
};
