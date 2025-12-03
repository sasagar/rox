import { S3Client } from "@aws-sdk/client-s3";
import { getDatabase } from "../db/index.js";
import type {
  IUserRepository,
  INoteRepository,
  IDriveFileRepository,
  IDriveFolderRepository,
  ISessionRepository,
  IReactionRepository,
  IFollowRepository,
  IInstanceBlockRepository,
  IInvitationCodeRepository,
  IUserReportRepository,
  IRoleRepository,
  IRoleAssignmentRepository,
  IInstanceSettingsRepository,
  ICustomEmojiRepository,
  IModerationAuditLogRepository,
  IUserWarningRepository,
  INotificationRepository,
  IRemoteInstanceRepository,
  IScheduledNoteRepository,
} from "../interfaces/repositories/index.js";
import type { IFileStorage } from "../interfaces/IFileStorage.js";
import type { ICacheService } from "../interfaces/ICacheService.js";
import {
  PostgresUserRepository,
  PostgresNoteRepository,
  PostgresDriveFileRepository,
  PostgresDriveFolderRepository,
  PostgresSessionRepository,
  PostgresReactionRepository,
  PostgresFollowRepository,
  PostgresInstanceBlockRepository,
  PostgresInvitationCodeRepository,
  PostgresUserReportRepository,
  PostgresRoleRepository,
  PostgresRoleAssignmentRepository,
  PostgresInstanceSettingsRepository,
  PostgresCustomEmojiRepository,
  PostgresModerationAuditLogRepository,
  PostgresUserWarningRepository,
  PostgresNotificationRepository,
  PostgresRemoteInstanceRepository,
  PostgresScheduledNoteRepository,
} from "../repositories/pg/index.js";
import { LocalStorageAdapter, S3StorageAdapter } from "../adapters/storage/index.js";
import { ActivityDeliveryQueue } from "../services/ap/ActivityDeliveryQueue.js";
import { DragonflyCacheAdapter } from "../adapters/cache/DragonflyCacheAdapter.js";
import { RemoteActorService } from "../services/ap/RemoteActorService.js";
import { RemoteNoteService } from "../services/ap/RemoteNoteService.js";
import { ActivityPubDeliveryService } from "../services/ap/ActivityPubDeliveryService.js";
import { RoleService } from "../services/RoleService.js";
import { InstanceSettingsService } from "../services/InstanceSettingsService.js";
import { MigrationService } from "../services/MigrationService.js";
import { NotificationService } from "../services/NotificationService.js";
import { WebPushService } from "../services/WebPushService.js";
import { RemoteInstanceService } from "../services/RemoteInstanceService.js";

export interface AppContainer {
  userRepository: IUserRepository;
  noteRepository: INoteRepository;
  driveFileRepository: IDriveFileRepository;
  driveFolderRepository: IDriveFolderRepository;
  sessionRepository: ISessionRepository;
  reactionRepository: IReactionRepository;
  followRepository: IFollowRepository;
  instanceBlockRepository: IInstanceBlockRepository;
  invitationCodeRepository: IInvitationCodeRepository;
  userReportRepository: IUserReportRepository;
  roleRepository: IRoleRepository;
  roleAssignmentRepository: IRoleAssignmentRepository;
  instanceSettingsRepository: IInstanceSettingsRepository;
  customEmojiRepository: ICustomEmojiRepository;
  moderationAuditLogRepository: IModerationAuditLogRepository;
  userWarningRepository: IUserWarningRepository;
  notificationRepository: INotificationRepository;
  remoteInstanceRepository: IRemoteInstanceRepository;
  scheduledNoteRepository: IScheduledNoteRepository;
  fileStorage: IFileStorage;
  cacheService: ICacheService;
  activityDeliveryQueue: ActivityDeliveryQueue;
  remoteActorService: RemoteActorService;
  remoteNoteService: RemoteNoteService;
  activityPubDeliveryService: ActivityPubDeliveryService;
  roleService: RoleService;
  instanceSettingsService: InstanceSettingsService;
  migrationService: MigrationService;
  notificationService: NotificationService;
  webPushService: WebPushService;
  remoteInstanceService: RemoteInstanceService;
}

/**
 * DIコンテナを作成
 * 環境変数に基づいて適切な実装を選択・注入
 */
export function createContainer(): AppContainer {
  const db = getDatabase();
  const dbType = process.env.DB_TYPE || "postgres";

  // Repository選択
  const repositories = createRepositories(db, dbType);

  // Storage Adapter選択
  const fileStorage = createStorageAdapter();

  // Cache Service (Dragonfly/Redis)
  const cacheService = new DragonflyCacheAdapter();
  // Initialize in background (non-blocking)
  cacheService.waitForInit().catch((error) => {
    console.warn("Cache service initialization failed (caching disabled):", error);
  });

  // Activity Delivery Queue
  const activityDeliveryQueue = new ActivityDeliveryQueue();
  // Initialize in background (non-blocking)
  activityDeliveryQueue.waitForInit().catch((error) => {
    console.error("Failed to initialize ActivityDeliveryQueue:", error);
  });

  // Remote Actor/Note Services for ActivityPub federation
  // Pass cacheService for L1 caching (memory cache for fast actor lookups)
  const remoteActorService = new RemoteActorService(
    repositories.userRepository,
    undefined, // signatureConfig - set later per request
    cacheService,
  );
  const remoteNoteService = new RemoteNoteService(
    repositories.noteRepository,
    repositories.userRepository,
    remoteActorService,
  );

  // ActivityPub Delivery Service
  const activityPubDeliveryService = new ActivityPubDeliveryService(
    repositories.userRepository,
    repositories.followRepository,
    activityDeliveryQueue,
    repositories.instanceBlockRepository,
  );

  // Role and Instance Settings Services
  const roleService = new RoleService(
    repositories.roleRepository,
    repositories.roleAssignmentRepository,
    cacheService,
  );
  const instanceSettingsService = new InstanceSettingsService(
    repositories.instanceSettingsRepository,
    cacheService,
  );

  // Migration Service for account migration
  const migrationService = new MigrationService(
    repositories.userRepository,
    repositories.followRepository,
    remoteActorService,
  );

  // Web Push Service
  const webPushService = new WebPushService(db, instanceSettingsService);

  // Notification Service
  const notificationService = new NotificationService(
    repositories.notificationRepository,
    repositories.userRepository,
  );

  // Wire up WebPushService with NotificationService
  notificationService.setWebPushService(webPushService);

  // Remote Instance Service for fetching federated server metadata
  const remoteInstanceService = new RemoteInstanceService(repositories.remoteInstanceRepository);

  return {
    ...repositories,
    fileStorage,
    cacheService,
    activityDeliveryQueue,
    remoteActorService,
    remoteNoteService,
    activityPubDeliveryService,
    roleService,
    instanceSettingsService,
    migrationService,
    notificationService,
    webPushService,
    remoteInstanceService,
  };
}

/**
 * データベースタイプに応じたRepositoryを作成
 */
function createRepositories(db: any, dbType: string) {
  switch (dbType) {
    case "postgres":
      return {
        userRepository: new PostgresUserRepository(db),
        noteRepository: new PostgresNoteRepository(db),
        driveFileRepository: new PostgresDriveFileRepository(db),
        driveFolderRepository: new PostgresDriveFolderRepository(db),
        sessionRepository: new PostgresSessionRepository(db),
        reactionRepository: new PostgresReactionRepository(db),
        followRepository: new PostgresFollowRepository(db),
        instanceBlockRepository: new PostgresInstanceBlockRepository(db),
        invitationCodeRepository: new PostgresInvitationCodeRepository(db),
        userReportRepository: new PostgresUserReportRepository(db),
        roleRepository: new PostgresRoleRepository(db),
        roleAssignmentRepository: new PostgresRoleAssignmentRepository(db),
        instanceSettingsRepository: new PostgresInstanceSettingsRepository(db),
        customEmojiRepository: new PostgresCustomEmojiRepository(db),
        moderationAuditLogRepository: new PostgresModerationAuditLogRepository(db),
        userWarningRepository: new PostgresUserWarningRepository(db),
        notificationRepository: new PostgresNotificationRepository(db),
        remoteInstanceRepository: new PostgresRemoteInstanceRepository(db),
        scheduledNoteRepository: new PostgresScheduledNoteRepository(db),
      };

    case "mysql":
      // TODO: MySQL実装（Phase 0完了後に追加）
      throw new Error("MySQL is not yet implemented");

    case "sqlite":
    case "d1":
      // TODO: SQLite/D1実装（Phase 0完了後に追加）
      throw new Error("SQLite/D1 is not yet implemented");

    default:
      throw new Error(`Unsupported database type: ${dbType}`);
  }
}

/**
 * ストレージタイプに応じたAdapterを作成
 */
function createStorageAdapter(): IFileStorage {
  const storageType = process.env.STORAGE_TYPE || "local";

  switch (storageType) {
    case "local": {
      const basePath = process.env.LOCAL_STORAGE_PATH || "./uploads";
      const baseUrl = process.env.URL || "http://localhost:3000";

      return new LocalStorageAdapter(basePath, baseUrl);
    }

    case "s3": {
      // S3設定の検証
      const endpoint = process.env.S3_ENDPOINT;
      const bucketName = process.env.S3_BUCKET_NAME;
      const accessKey = process.env.S3_ACCESS_KEY;
      const secretKey = process.env.S3_SECRET_KEY;
      const region = process.env.S3_REGION || "auto";
      const publicUrl = process.env.S3_PUBLIC_URL;

      if (!endpoint || !bucketName || !accessKey || !secretKey || !publicUrl) {
        throw new Error(
          "Missing required S3 configuration. Please check S3_ENDPOINT, S3_BUCKET_NAME, S3_ACCESS_KEY, S3_SECRET_KEY, and S3_PUBLIC_URL environment variables.",
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
