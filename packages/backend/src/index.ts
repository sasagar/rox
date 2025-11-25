import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { diMiddleware, errorHandler } from './middleware/index.js';
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
import packageJson from '../../../package.json';

const app = new Hono();

// グローバルミドルウェア
app.use('*', logger());
app.use('*', errorHandler);
app.use('*', cors());
app.use('*', diMiddleware());

// ヘルスチェック
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: packageJson.version,
  });
});

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

// ActivityPubルート
app.route('/', webfingerRoute); // /.well-known/webfinger
app.route('/users', actorRoute); // /users/:username
app.route('/', inboxRoute); // /users/:username/inbox
app.route('/users', outboxRoute); // /users/:username/outbox
app.route('/users', followersRoute); // /users/:username/followers
app.route('/users', followingAPRoute); // /users/:username/following
app.route('/', noteAPRoute); // /notes/:id

const port = parseInt(process.env.PORT || '3000', 10);

console.log(`🚀 Rox API server starting on port ${port}`);
console.log(`📊 Database: ${process.env.DB_TYPE || 'postgres'}`);
console.log(`💾 Storage: ${process.env.STORAGE_TYPE || 'local'}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

export default {
  port,
  fetch: app.fetch,
};
