import type { Context, Next } from 'hono';
import { getContainer, type AppContainer } from '../di/container.js';

/**
 * DIミドルウェア
 * コンテナの内容をHonoのContextに注入
 */
export function diMiddleware() {
  const container = getContainer();

  return async (c: Context, next: Next) => {
    // コンテナの各プロパティをContextに設定
    c.set('userRepository', container.userRepository);
    c.set('noteRepository', container.noteRepository);
    c.set('driveFileRepository', container.driveFileRepository);
    c.set('sessionRepository', container.sessionRepository);
    c.set('reactionRepository', container.reactionRepository);
    c.set('followRepository', container.followRepository);
    c.set('instanceBlockRepository', container.instanceBlockRepository);
    c.set('fileStorage', container.fileStorage);
    c.set('cacheService', container.cacheService);
    c.set('activityDeliveryQueue', container.activityDeliveryQueue);
    c.set('remoteActorService', container.remoteActorService);
    c.set('remoteNoteService', container.remoteNoteService);
    c.set('activityPubDeliveryService', container.activityPubDeliveryService);

    await next();
  };
}

// Hono Context型の拡張
declare module 'hono' {
  interface ContextVariableMap extends AppContainer {}
}
