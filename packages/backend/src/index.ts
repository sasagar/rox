import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { diMiddleware, errorHandler, securityHeaders, requestLogger, metricsMiddleware } from './middleware/index.js';
import { logger } from './lib/logger.js';
import metricsRoute from './routes/metrics.js';
import usersRoute from './routes/users.js';
import authRoute from './routes/auth.js';
import driveRoute from './routes/drive.js';
import notesRoute from './routes/notes.js';
import reactionsRoute from './routes/reactions.js';
import followingRoute from './routes/following.js';
import actorRoute from './routes/ap/actor.js';
import webfingerRoute from './routes/ap/webfinger.js';
import inboxRoute from './routes/ap/inbox.js';
import outboxRoute from './routes/ap/outbox.js';
import followersRoute from './routes/ap/followers.js';
import followingAPRoute from './routes/ap/following.js';
import noteAPRoute from './routes/ap/note.js';
import nodeinfoRoute from './routes/ap/nodeinfo.js';
import proxyRoute from './routes/proxy.js';
import healthRoute from './routes/health.js';
import adminRoute from './routes/admin.js';
import reportsRoute from './routes/reports.js';
import invitationsRoute from './routes/invitations.js';
import instanceRoute from './routes/instance.js';
import emojisRoute from './routes/emojis.js';
import migrationRoute from './routes/migration.js';
import packageJson from '../../../package.json';
import { ReceivedActivitiesCleanupService } from './services/ReceivedActivitiesCleanupService.js';
import { getContainer } from './di/container.js';

const app = new Hono();

// Global middleware
app.use('*', metricsMiddleware());
app.use('*', requestLogger());
app.use('*', errorHandler);
app.use('*', securityHeaders());
app.use('*', cors());
app.use('*', diMiddleware());

// Health check and metrics routes
app.route('/health', healthRoute);
app.route('/metrics', metricsRoute);

// ルートエンドポイント
app.get('/', (c) => {
  return c.json({
    name: 'Rox API',
    version: packageJson.version,
    description: 'Lightweight ActivityPub server with Misskey API compatibility',
  });
});

// APIルート
app.route('/api/users', usersRoute);
app.route('/api/auth', authRoute);
app.route('/api/drive', driveRoute);
app.route('/api/notes', notesRoute);
app.route('/api/notes/reactions', reactionsRoute);
app.route('/api/following', followingRoute);
app.route('/api/admin', adminRoute);
app.route('/api/reports', reportsRoute);
app.route('/api/invitations', invitationsRoute);
app.route('/api/instance', instanceRoute);
app.route('/api/emojis', emojisRoute);
app.route('/api/i/migration', migrationRoute);

// Media Proxy
app.route('/proxy', proxyRoute);

// ActivityPubルート
app.route('/', webfingerRoute); // /.well-known/webfinger
app.route('/', nodeinfoRoute); // /.well-known/nodeinfo, /nodeinfo/*
app.route('/users', actorRoute); // /users/:username
app.route('/', inboxRoute); // /users/:username/inbox
app.route('/users', outboxRoute); // /users/:username/outbox
app.route('/users', followersRoute); // /users/:username/followers
app.route('/users', followingAPRoute); // /users/:username/following
app.route('/', noteAPRoute); // /notes/:id

const port = parseInt(process.env.PORT || '3000', 10);

logger.info({
  port,
  database: process.env.DB_TYPE || 'postgres',
  storage: process.env.STORAGE_TYPE || 'local',
  environment: process.env.NODE_ENV || 'development',
}, 'Rox API server starting');

// Start cleanup service for received activities
const cleanupService = new ReceivedActivitiesCleanupService({
  retentionDays: 7,
  intervalMs: 24 * 60 * 60 * 1000, // 24 hours
});
cleanupService.start();

// Graceful shutdown handler
let isShuttingDown = false;

async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.warn({ signal }, 'Shutdown already in progress');
    return;
  }

  isShuttingDown = true;
  logger.info({ signal }, 'Starting graceful shutdown');

  const shutdownTimeout = setTimeout(() => {
    logger.error('Shutdown timeout exceeded, forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Stop accepting new requests (handled by isShuttingDown flag)
    logger.info('Stopping cleanup service');
    cleanupService.stop();

    // Shutdown activity delivery queue (drains pending jobs)
    logger.info('Shutting down activity delivery queue');
    const container = getContainer();
    await container.activityDeliveryQueue.shutdown();

    logger.info('Graceful shutdown complete');
    clearTimeout(shutdownTimeout);
    process.exit(0);
  } catch (error) {
    logger.error({ err: error }, 'Error during shutdown');
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default {
  port,
  fetch: app.fetch,
};
