import { S3Client } from '@aws-sdk/client-s3';
import { getDatabase } from '../db/index.js';
import type {
  IUserRepository,
  INoteRepository,
  IDriveFileRepository,
  ISessionRepository,
  IReactionRepository,
  IFollowRepository,
} from '../interfaces/repositories/index.js';
import type { IFileStorage } from '../interfaces/IFileStorage.js';
import type { ICacheService } from '../interfaces/ICacheService.js';
import {
  PostgresUserRepository,
  PostgresNoteRepository,
  PostgresDriveFileRepository,
  PostgresSessionRepository,
  PostgresReactionRepository,
  PostgresFollowRepository,
} from '../repositories/pg/index.js';
import {
  LocalStorageAdapter,
  S3StorageAdapter,
} from '../adapters/storage/index.js';
import { ActivityDeliveryQueue } from '../services/ap/ActivityDeliveryQueue.js';
import { DragonflyCacheAdapter } from '../adapters/cache/DragonflyCacheAdapter.js';
import { RemoteActorService } from '../services/ap/RemoteActorService.js';
import { RemoteNoteService } from '../services/ap/RemoteNoteService.js';
import { ActivityPubDeliveryService } from '../services/ap/ActivityPubDeliveryService.js';

export interface AppContainer {
  userRepository: IUserRepository;
  noteRepository: INoteRepository;
  driveFileRepository: IDriveFileRepository;
  sessionRepository: ISessionRepository;
  reactionRepository: IReactionRepository;
  followRepository: IFollowRepository;
  fileStorage: IFileStorage;
  cacheService: ICacheService;
  activityDeliveryQueue: ActivityDeliveryQueue;
  remoteActorService: RemoteActorService;
  remoteNoteService: RemoteNoteService;
  activityPubDeliveryService: ActivityPubDeliveryService;
}

/**
 * DIコンテナを作成
 * 環境変数に基づいて適切な実装を選択・注入
 */
export function createContainer(): AppContainer {
  const db = getDatabase();
  const dbType = process.env.DB_TYPE || 'postgres';

  // Repository選択
  const repositories = createRepositories(db, dbType);

  // Storage Adapter選択
  const fileStorage = createStorageAdapter();

  // Cache Service (Dragonfly/Redis)
  const cacheService = new DragonflyCacheAdapter();
  // Initialize in background (non-blocking)
  cacheService.waitForInit().catch((error) => {
    console.warn('Cache service initialization failed (caching disabled):', error);
  });

  // Activity Delivery Queue
  const activityDeliveryQueue = new ActivityDeliveryQueue();
  // Initialize in background (non-blocking)
  activityDeliveryQueue.waitForInit().catch((error) => {
    console.error('Failed to initialize ActivityDeliveryQueue:', error);
  });

  // Remote Actor/Note Services for ActivityPub federation
  const remoteActorService = new RemoteActorService(repositories.userRepository);
  const remoteNoteService = new RemoteNoteService(
    repositories.noteRepository,
    repositories.userRepository,
    remoteActorService
  );

  // ActivityPub Delivery Service
  const activityPubDeliveryService = new ActivityPubDeliveryService(
    repositories.userRepository,
    repositories.followRepository,
    activityDeliveryQueue
  );

  return {
    ...repositories,
    fileStorage,
    cacheService,
    activityDeliveryQueue,
    remoteActorService,
    remoteNoteService,
    activityPubDeliveryService,
  };
}

/**
 * データベースタイプに応じたRepositoryを作成
 */
function createRepositories(db: any, dbType: string) {
  switch (dbType) {
    case 'postgres':
      return {
        userRepository: new PostgresUserRepository(db),
        noteRepository: new PostgresNoteRepository(db),
        driveFileRepository: new PostgresDriveFileRepository(db),
        sessionRepository: new PostgresSessionRepository(db),
        reactionRepository: new PostgresReactionRepository(db),
        followRepository: new PostgresFollowRepository(db),
      };

    case 'mysql':
      // TODO: MySQL実装（Phase 0完了後に追加）
      throw new Error('MySQL is not yet implemented');

    case 'sqlite':
    case 'd1':
      // TODO: SQLite/D1実装（Phase 0完了後に追加）
      throw new Error('SQLite/D1 is not yet implemented');

    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

/**
 * ストレージタイプに応じたAdapterを作成
 */
function createStorageAdapter(): IFileStorage {
  const storageType = process.env.STORAGE_TYPE || 'local';

  switch (storageType) {
    case 'local': {
      const basePath = process.env.LOCAL_STORAGE_PATH || './uploads';
      const baseUrl = process.env.URL || 'http://localhost:3000';

      return new LocalStorageAdapter(basePath, baseUrl);
    }

    case 's3': {
      // S3設定の検証
      const endpoint = process.env.S3_ENDPOINT;
      const bucketName = process.env.S3_BUCKET_NAME;
      const accessKey = process.env.S3_ACCESS_KEY;
      const secretKey = process.env.S3_SECRET_KEY;
      const region = process.env.S3_REGION || 'auto';
      const publicUrl = process.env.S3_PUBLIC_URL;

      if (!endpoint || !bucketName || !accessKey || !secretKey || !publicUrl) {
        throw new Error(
          'Missing required S3 configuration. Please check S3_ENDPOINT, S3_BUCKET_NAME, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_PUBLIC_URL environment variables.'
        );
      }

      // S3クライアントの作成
      const s3Client = new S3Client({
        endpoint,
        region,
        credentials: {
          accessKeyId: accessKey,
          secretAccessKey: secretKey,
        },
      });

      return new S3StorageAdapter(s3Client, bucketName, publicUrl);
    }

    default:
      throw new Error(`Unsupported storage type: ${storageType}`);
  }
}

// Singletonインスタンス
let containerInstance: AppContainer | null = null;

/**
 * DIコンテナのシングルトンインスタンスを取得
 */
export function getContainer(): AppContainer {
  if (!containerInstance) {
    containerInstance = createContainer();
  }
  return containerInstance;
}

/**
 * テスト用：コンテナをリセット
 */
export function resetContainer(): void {
  containerInstance = null;
}
