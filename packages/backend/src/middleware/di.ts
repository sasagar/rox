import type { Context, Next } from "hono";
import { getContainer, type AppContainer } from "../di/container.js";

/**
 * DIミドルウェア
 * コンテナの内容をHonoのContextに注入
 */
export function diMiddleware() {
  const container = getContainer();

  return async (c: Context, next: Next) => {
    // コンテナの各プロパティをContextに設定
    c.set("userRepository", container.userRepository);
    c.set("noteRepository", container.noteRepository);
    c.set("driveFileRepository", container.driveFileRepository);
    c.set("driveFolderRepository", container.driveFolderRepository);
    c.set("sessionRepository", container.sessionRepository);
    c.set("reactionRepository", container.reactionRepository);
    c.set("followRepository", container.followRepository);
    c.set("instanceBlockRepository", container.instanceBlockRepository);
    c.set("invitationCodeRepository", container.invitationCodeRepository);
    c.set("userReportRepository", container.userReportRepository);
    c.set("roleRepository", container.roleRepository);
    c.set("roleAssignmentRepository", container.roleAssignmentRepository);
    c.set("instanceSettingsRepository", container.instanceSettingsRepository);
    c.set("customEmojiRepository", container.customEmojiRepository);
    c.set("moderationAuditLogRepository", container.moderationAuditLogRepository);
    c.set("userWarningRepository", container.userWarningRepository);
    c.set("notificationRepository", container.notificationRepository);
    c.set("remoteInstanceRepository", container.remoteInstanceRepository);
    c.set("scheduledNoteRepository", container.scheduledNoteRepository);
    c.set("passkeyCredentialRepository", container.passkeyCredentialRepository);
    c.set("passkeyChallengeRepository", container.passkeyChallengeRepository);
    c.set("fileStorage", container.fileStorage);
    c.set("cacheService", container.cacheService);
    c.set("activityDeliveryQueue", container.activityDeliveryQueue);
    c.set("remoteActorService", container.remoteActorService);
    c.set("remoteNoteService", container.remoteNoteService);
    c.set("activityPubDeliveryService", container.activityPubDeliveryService);
    c.set("roleService", container.roleService);
    c.set("instanceSettingsService", container.instanceSettingsService);
    c.set("migrationService", container.migrationService);
    c.set("notificationService", container.notificationService);
    c.set("webPushService", container.webPushService);
    c.set("remoteInstanceService", container.remoteInstanceService);
    c.set("userDeletionService", container.userDeletionService);
    c.set("userDataExportService", container.userDataExportService);
    c.set("contactRepository", container.contactRepository);
    c.set("blockedUsernameService", container.blockedUsernameService);
    c.set("blockedUsernameRepository", container.blockedUsernameRepository);
    c.set("systemAccountService", container.systemAccountService);
    c.set("listRepository", container.listRepository);

    // Also set the container itself for routes that need multiple services
    c.set("container", container);

    await next();
  };
}

// Hono Context型の拡張
declare module "hono" {
  interface ContextVariableMap extends AppContainer {
    container: AppContainer;
  }
}
