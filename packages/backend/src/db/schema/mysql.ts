/**
 * MySQL Database Schema
 *
 * This schema is designed to work with MySQL 8.0+ and MariaDB 10.5+.
 *
 * Key differences from PostgreSQL:
 * - Uses `datetime` instead of `timestamp` (MySQL timestamp has 2038 problem)
 * - Uses `json` type (MySQL 5.7+ / MariaDB 10.2+)
 * - Uses `varchar` with explicit length for indexed text columns
 * - Uses `tinyint(1)` for booleans
 *
 * @module db/schema/mysql
 */

import {
  mysqlTable,
  text,
  varchar,
  datetime,
  boolean,
  int,
  json,
  index,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

/**
 * Profile emoji structure
 * Represents custom emojis used in user profile (name/bio)
 * Retrieved from ActivityPub actor tags
 */
export interface ProfileEmoji {
  /** Emoji shortcode (e.g., "custom_emoji" without colons) */
  name: string;
  /** URL to the emoji image */
  url: string;
}

/**
 * User UI settings structure
 * Allows users to customize their viewing experience
 */
export interface UISettings {
  /** Font size: 'small' (12px), 'medium' (14px), 'large' (16px), 'xlarge' (18px) */
  fontSize?: "small" | "medium" | "large" | "xlarge";
  /** Line height: 'compact' (1.4), 'normal' (1.6), 'relaxed' (1.8) */
  lineHeight?: "compact" | "normal" | "relaxed";
  /** Content width: 'narrow' (600px), 'normal' (800px), 'wide' (1000px) */
  contentWidth?: "narrow" | "normal" | "wide";
  /** Theme: 'light', 'dark', 'system' */
  theme?: "light" | "dark" | "system";
  /** Custom CSS applied to the entire app (for this user only) */
  appCustomCss?: string;
}

/**
 * Role policies structure (Misskey-style)
 * Defines permissions and limits that can be controlled by roles
 */
export interface RolePolicies {
  canViewGlobalTimeline?: boolean;
  canViewLocalTimeline?: boolean;
  canPublicNote?: boolean;
  canCreateNote?: boolean;
  canInvite?: boolean;
  inviteLimit?: number;
  inviteLimitCycle?: number;
  rateLimitFactor?: number;
  driveCapacityMb?: number;
  maxFileSizeMb?: number;
  canManageStorageQuotas?: boolean;
  canViewSystemAcquiredFiles?: boolean;
  maxScheduledNotes?: number;
  canManageReports?: boolean;
  canDeleteNotes?: boolean;
  canSuspendUsers?: boolean;
  canManageRoles?: boolean;
  canManageInstanceSettings?: boolean;
  canManageInstanceBlocks?: boolean;
  canManageUsers?: boolean;
  canManageCustomEmojis?: boolean;
}

// Users table
export const users = mysqlTable(
  "users",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    username: varchar("username", { length: 128 }).notNull(),
    email: varchar("email", { length: 256 }).notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: varchar("display_name", { length: 128 }),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    bannerUrl: text("banner_url"),
    isAdmin: boolean("is_admin").notNull().default(false),
    isSuspended: boolean("is_suspended").notNull().default(false),
    // Soft delete fields for account deletion
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: datetime("deleted_at"),
    publicKey: text("public_key"),
    privateKey: text("private_key"),
    host: varchar("host", { length: 256 }),
    inbox: text("inbox"),
    outbox: text("outbox"),
    followersUrl: text("followers_url"),
    followingUrl: text("following_url"),
    uri: varchar("uri", { length: 512 }),
    sharedInbox: text("shared_inbox"),
    alsoKnownAs: json("also_known_as").$type<string[]>().default([]),
    movedTo: text("moved_to"),
    movedAt: datetime("moved_at"),
    customCss: text("custom_css"),
    uiSettings: json("ui_settings").$type<UISettings>(),
    profileEmojis: json("profile_emojis").$type<ProfileEmoji[]>().default([]),
    storageQuotaMb: int("storage_quota_mb"),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    usernameHostIdx: uniqueIndex("username_host_idx").on(table.username, table.host),
    emailIdx: uniqueIndex("email_idx").on(table.email),
    uriIdx: index("uri_idx").on(table.uri),
    isDeletedIdx: index("user_is_deleted_idx").on(table.isDeleted),
  }),
);

// Sessions table
export const sessions = mysqlTable(
  "sessions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: varchar("token", { length: 256 }).notNull().unique(),
    expiresAt: datetime("expires_at").notNull(),
    userAgent: text("user_agent"),
    ipAddress: varchar("ip_address", { length: 45 }),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tokenIdx: uniqueIndex("token_idx").on(table.token),
    userIdIdx: index("session_user_id_idx").on(table.userId),
  }),
);

// Passkey credentials table
export const passkeyCredentials = mysqlTable(
  "passkey_credentials",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: varchar("credential_id", { length: 512 }).notNull().unique(),
    publicKey: text("public_key").notNull(),
    counter: int("counter").notNull().default(0),
    deviceType: varchar("device_type", { length: 32 }),
    backedUp: boolean("backed_up").notNull().default(false),
    transports: json("transports").$type<string[]>().default([]),
    name: varchar("name", { length: 128 }),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    lastUsedAt: datetime("last_used_at"),
  },
  (table) => ({
    credentialIdIdx: uniqueIndex("passkey_credential_id_idx").on(table.credentialId),
    userIdIdx: index("passkey_user_id_idx").on(table.userId),
  }),
);

// Passkey challenges table
export const passkeyChallenges = mysqlTable(
  "passkey_challenges",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    challenge: varchar("challenge", { length: 256 }).notNull().unique(),
    userId: varchar("user_id", { length: 32 }).references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull(),
    expiresAt: datetime("expires_at").notNull(),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    challengeIdx: uniqueIndex("passkey_challenge_idx").on(table.challenge),
    expiresAtIdx: index("passkey_challenge_expires_idx").on(table.expiresAt),
  }),
);

// Notes table
export const notes = mysqlTable(
  "notes",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text"),
    cw: varchar("cw", { length: 256 }),
    visibility: varchar("visibility", { length: 32 }).notNull().default("public"),
    localOnly: boolean("local_only").notNull().default(false),
    replyId: varchar("reply_id", { length: 32 }),
    renoteId: varchar("renote_id", { length: 32 }),
    fileIds: json("file_ids").$type<string[]>().notNull().default([]),
    mentions: json("mentions").$type<string[]>().notNull().default([]),
    emojis: json("emojis").$type<string[]>().notNull().default([]),
    tags: json("tags").$type<string[]>().notNull().default([]),
    uri: varchar("uri", { length: 512 }),
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: datetime("deleted_at"),
    deletedById: varchar("deleted_by_id", { length: 32 }).references(() => users.id, {
      onDelete: "set null",
    }),
    deletionReason: text("deletion_reason"),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("note_user_id_idx").on(table.userId),
    createdAtIdx: index("note_created_at_idx").on(table.createdAt),
    replyIdIdx: index("note_reply_id_idx").on(table.replyId),
    renoteIdIdx: index("note_renote_id_idx").on(table.renoteId),
    uriIdx: uniqueIndex("note_uri_idx").on(table.uri),
    userTimelineIdx: index("note_user_timeline_idx").on(table.userId, table.createdAt),
    isDeletedIdx: index("note_is_deleted_idx").on(table.isDeleted),
  }),
);

// Drive folders table
export const driveFolders = mysqlTable(
  "drive_folders",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: varchar("parent_id", { length: 32 }),
    name: varchar("name", { length: 256 }).notNull(),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("folder_user_id_idx").on(table.userId),
    parentIdIdx: index("folder_parent_id_idx").on(table.parentId),
  }),
);

// Drive files table
export const driveFiles = mysqlTable(
  "drive_files",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    folderId: varchar("folder_id", { length: 32 }).references(() => driveFolders.id, {
      onDelete: "set null",
    }),
    name: varchar("name", { length: 256 }).notNull(),
    type: varchar("type", { length: 128 }).notNull(),
    size: int("size").notNull(),
    md5: varchar("md5", { length: 32 }).notNull(),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    blurhash: varchar("blurhash", { length: 128 }),
    comment: text("comment"),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    storageKey: varchar("storage_key", { length: 512 }).notNull(),
    source: varchar("source", { length: 32 }).notNull().default("user"),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("file_user_id_idx").on(table.userId),
    folderIdIdx: index("file_folder_id_idx").on(table.folderId),
    md5Idx: index("file_md5_idx").on(table.md5),
    sourceIdx: index("file_source_idx").on(table.source),
  }),
);

// Reactions table
export const reactions = mysqlTable(
  "reactions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    noteId: varchar("note_id", { length: 32 })
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    reaction: varchar("reaction", { length: 256 }).notNull(),
    customEmojiUrl: text("custom_emoji_url"),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userNoteReactionIdx: uniqueIndex("reaction_user_note_reaction_idx").on(
      table.userId,
      table.noteId,
      table.reaction,
    ),
    noteIdIdx: index("reaction_note_id_idx").on(table.noteId),
  }),
);

// Follows table
export const follows = mysqlTable(
  "follows",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    followerId: varchar("follower_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: varchar("followee_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    followerFolloweeIdx: uniqueIndex("follow_follower_followee_idx").on(
      table.followerId,
      table.followeeId,
    ),
    followerIdx: index("follow_follower_idx").on(table.followerId),
    followeeIdx: index("follow_followee_idx").on(table.followeeId),
  }),
);

// Received Activities table
export const receivedActivities = mysqlTable(
  "received_activities",
  {
    activityId: varchar("activity_id", { length: 512 }).primaryKey(),
    receivedAt: datetime("received_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    receivedAtIdx: index("received_activities_received_at_idx").on(table.receivedAt),
  }),
);

// Instance blocks table
export const instanceBlocks = mysqlTable(
  "instance_blocks",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    host: varchar("host", { length: 256 }).notNull().unique(),
    reason: text("reason"),
    blockedById: varchar("blocked_by_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    hostIdx: uniqueIndex("instance_block_host_idx").on(table.host),
  }),
);

// Invitation codes table
export const invitationCodes = mysqlTable(
  "invitation_codes",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    code: varchar("code", { length: 64 }).notNull().unique(),
    createdById: varchar("created_by_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    usedById: varchar("used_by_id", { length: 32 }).references(() => users.id, {
      onDelete: "set null",
    }),
    usedAt: datetime("used_at"),
    expiresAt: datetime("expires_at"),
    maxUses: int("max_uses").default(1),
    useCount: int("use_count").notNull().default(0),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    codeIdx: uniqueIndex("invitation_code_idx").on(table.code),
    createdByIdx: index("invitation_created_by_idx").on(table.createdById),
  }),
);

// Roles table
export const roles = mysqlTable(
  "roles",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    name: varchar("name", { length: 64 }).notNull().unique(),
    description: text("description"),
    color: varchar("color", { length: 16 }),
    iconUrl: text("icon_url"),
    displayOrder: int("display_order").notNull().default(0),
    isPublic: boolean("is_public").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    isAdminRole: boolean("is_admin_role").notNull().default(false),
    isModeratorRole: boolean("is_moderator_role").notNull().default(false),
    policies: json("policies").$type<RolePolicies>().notNull().default({}),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    nameIdx: uniqueIndex("role_name_idx").on(table.name),
    displayOrderIdx: index("role_display_order_idx").on(table.displayOrder),
  }),
);

// Role assignments table
export const roleAssignments = mysqlTable(
  "role_assignments",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: varchar("role_id", { length: 32 })
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    expiresAt: datetime("expires_at"),
    assignedById: varchar("assigned_by_id", { length: 32 }).references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userRoleIdx: uniqueIndex("role_assignment_user_role_idx").on(table.userId, table.roleId),
    userIdx: index("role_assignment_user_idx").on(table.userId),
    roleIdx: index("role_assignment_role_idx").on(table.roleId),
  }),
);

// Instance settings table
export const instanceSettings = mysqlTable("instance_settings", {
  key: varchar("key", { length: 128 }).primaryKey(),
  value: json("value").notNull(),
  updatedAt: datetime("updated_at")
    .notNull()
    .$defaultFn(() => new Date()),
  updatedById: varchar("updated_by_id", { length: 32 }).references(() => users.id, {
    onDelete: "set null",
  }),
});

// User reports table
export const userReports = mysqlTable(
  "user_reports",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    reporterId: varchar("reporter_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: varchar("target_user_id", { length: 32 }).references(() => users.id, {
      onDelete: "set null",
    }),
    targetNoteId: varchar("target_note_id", { length: 32 }).references(() => notes.id, {
      onDelete: "set null",
    }),
    reason: varchar("reason", { length: 64 }).notNull(),
    comment: text("comment"),
    status: varchar("status", { length: 32 }).notNull().default("pending"),
    resolvedById: varchar("resolved_by_id", { length: 32 }).references(() => users.id, {
      onDelete: "set null",
    }),
    resolvedAt: datetime("resolved_at"),
    resolution: text("resolution"),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    reporterIdx: index("report_reporter_idx").on(table.reporterId),
    targetUserIdx: index("report_target_user_idx").on(table.targetUserId),
    targetNoteIdx: index("report_target_note_idx").on(table.targetNoteId),
    statusIdx: index("report_status_idx").on(table.status),
    createdAtIdx: index("report_created_at_idx").on(table.createdAt),
  }),
);

// Moderation audit logs table
export const moderationAuditLogs = mysqlTable(
  "moderation_audit_logs",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    moderatorId: varchar("moderator_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 64 }).notNull(),
    targetType: varchar("target_type", { length: 32 }).notNull(),
    targetId: varchar("target_id", { length: 32 }).notNull(),
    reason: text("reason"),
    details: json("details").$type<Record<string, unknown>>(),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    moderatorIdx: index("audit_moderator_idx").on(table.moderatorId),
    actionIdx: index("audit_action_idx").on(table.action),
    targetTypeIdx: index("audit_target_type_idx").on(table.targetType),
    targetIdIdx: index("audit_target_id_idx").on(table.targetId),
    createdAtIdx: index("audit_created_at_idx").on(table.createdAt),
  }),
);

// User warnings table
export const userWarnings = mysqlTable(
  "user_warnings",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moderatorId: varchar("moderator_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    isRead: boolean("is_read").notNull().default(false),
    readAt: datetime("read_at"),
    expiresAt: datetime("expires_at"),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdx: index("warning_user_idx").on(table.userId),
    moderatorIdx: index("warning_moderator_idx").on(table.moderatorId),
    isReadIdx: index("warning_is_read_idx").on(table.isRead),
    createdAtIdx: index("warning_created_at_idx").on(table.createdAt),
  }),
);

// Custom emojis table
export const customEmojis = mysqlTable(
  "custom_emojis",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    name: varchar("name", { length: 128 }).notNull(),
    host: varchar("host", { length: 256 }),
    category: varchar("category", { length: 64 }),
    aliases: json("aliases").$type<string[]>().notNull().default([]),
    url: text("url").notNull(),
    publicUrl: text("public_url"),
    license: text("license"),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    localOnly: boolean("local_only").notNull().default(false),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    nameHostIdx: uniqueIndex("emoji_name_host_idx").on(table.name, table.host),
    hostIdx: index("emoji_host_idx").on(table.host),
    categoryIdx: index("emoji_category_idx").on(table.category),
  }),
);

/**
 * Notification types enum
 */
export type NotificationType =
  | "follow"
  | "mention"
  | "reply"
  | "reaction"
  | "renote"
  | "warning"
  | "follow_request_accepted"
  | "quote";

// Notifications table
export const notifications = mysqlTable(
  "notifications",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 32 }).notNull().$type<NotificationType>(),
    notifierId: varchar("notifier_id", { length: 32 }).references(() => users.id, {
      onDelete: "cascade",
    }),
    noteId: varchar("note_id", { length: 32 }).references(() => notes.id, { onDelete: "cascade" }),
    reaction: varchar("reaction", { length: 256 }),
    warningId: varchar("warning_id", { length: 32 }).references(() => userWarnings.id, {
      onDelete: "cascade",
    }),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("notification_user_id_idx").on(table.userId),
    userIdIsReadIdx: index("notification_user_id_is_read_idx").on(table.userId, table.isRead),
    userIdCreatedAtIdx: index("notification_user_id_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    typeIdx: index("notification_type_idx").on(table.type),
  }),
);

// Push subscriptions table
export const pushSubscriptions = mysqlTable(
  "push_subscriptions",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: varchar("auth", { length: 64 }).notNull(),
    userAgent: text("user_agent"),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("push_subscription_user_id_idx").on(table.userId),
    // MySQL requires prefix length for TEXT index
    // endpointIdx: uniqueIndex("push_subscription_endpoint_idx").on(table.endpoint),
  }),
);

// Remote instances table
export const remoteInstances = mysqlTable(
  "remote_instances",
  {
    host: varchar("host", { length: 256 }).primaryKey(),
    softwareName: varchar("software_name", { length: 64 }),
    softwareVersion: varchar("software_version", { length: 64 }),
    name: varchar("name", { length: 256 }),
    description: text("description"),
    iconUrl: text("icon_url"),
    themeColor: varchar("theme_color", { length: 16 }),
    openRegistrations: boolean("open_registrations"),
    usersCount: int("users_count"),
    notesCount: int("notes_count"),
    isBlocked: boolean("is_blocked").notNull().default(false),
    lastFetchedAt: datetime("last_fetched_at"),
    fetchErrorCount: int("fetch_error_count").notNull().default(0),
    lastFetchError: text("last_fetch_error"),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    softwareNameIdx: index("remote_instance_software_name_idx").on(table.softwareName),
    lastFetchedAtIdx: index("remote_instance_last_fetched_at_idx").on(table.lastFetchedAt),
  }),
);

/**
 * Scheduled note status type
 */
export type ScheduledNoteStatus = "pending" | "published" | "failed" | "cancelled";

// Scheduled notes table
export const scheduledNotes = mysqlTable(
  "scheduled_notes",
  {
    id: varchar("id", { length: 32 }).primaryKey(),
    userId: varchar("user_id", { length: 32 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text"),
    cw: varchar("cw", { length: 256 }),
    visibility: varchar("visibility", { length: 32 }).notNull().default("public"),
    localOnly: boolean("local_only").notNull().default(false),
    replyId: varchar("reply_id", { length: 32 }),
    renoteId: varchar("renote_id", { length: 32 }),
    fileIds: json("file_ids").$type<string[]>().notNull().default([]),
    scheduledAt: datetime("scheduled_at").notNull(),
    status: varchar("status", { length: 32 }).notNull().default("pending").$type<ScheduledNoteStatus>(),
    publishedNoteId: varchar("published_note_id", { length: 32 }).references(() => notes.id, {
      onDelete: "set null",
    }),
    errorMessage: text("error_message"),
    createdAt: datetime("created_at")
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: datetime("updated_at")
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("scheduled_note_user_id_idx").on(table.userId),
    scheduledAtIdx: index("scheduled_note_scheduled_at_idx").on(table.scheduledAt),
    statusIdx: index("scheduled_note_status_idx").on(table.status),
    pendingScheduleIdx: index("scheduled_note_pending_schedule_idx").on(
      table.status,
      table.scheduledAt,
    ),
  }),
);

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type PasskeyCredential = typeof passkeyCredentials.$inferSelect;
export type NewPasskeyCredential = typeof passkeyCredentials.$inferInsert;
export type PasskeyChallenge = typeof passkeyChallenges.$inferSelect;
export type NewPasskeyChallenge = typeof passkeyChallenges.$inferInsert;
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;
export type DriveFile = typeof driveFiles.$inferSelect;
export type NewDriveFile = typeof driveFiles.$inferInsert;
export type Reaction = typeof reactions.$inferSelect;
export type NewReaction = typeof reactions.$inferInsert;
export type Follow = typeof follows.$inferSelect;
export type NewFollow = typeof follows.$inferInsert;
export type ReceivedActivity = typeof receivedActivities.$inferSelect;
export type NewReceivedActivity = typeof receivedActivities.$inferInsert;
export type InstanceBlock = typeof instanceBlocks.$inferSelect;
export type NewInstanceBlock = typeof instanceBlocks.$inferInsert;
export type InvitationCode = typeof invitationCodes.$inferSelect;
export type NewInvitationCode = typeof invitationCodes.$inferInsert;
export type UserReport = typeof userReports.$inferSelect;
export type NewUserReport = typeof userReports.$inferInsert;
export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type RoleAssignment = typeof roleAssignments.$inferSelect;
export type NewRoleAssignment = typeof roleAssignments.$inferInsert;
export type InstanceSetting = typeof instanceSettings.$inferSelect;
export type NewInstanceSetting = typeof instanceSettings.$inferInsert;
export type CustomEmoji = typeof customEmojis.$inferSelect;
export type NewCustomEmoji = typeof customEmojis.$inferInsert;
export type ModerationAuditLog = typeof moderationAuditLogs.$inferSelect;
export type NewModerationAuditLog = typeof moderationAuditLogs.$inferInsert;
export type UserWarning = typeof userWarnings.$inferSelect;
export type NewUserWarning = typeof userWarnings.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type NewPushSubscription = typeof pushSubscriptions.$inferInsert;
export type RemoteInstance = typeof remoteInstances.$inferSelect;
export type NewRemoteInstance = typeof remoteInstances.$inferInsert;
export type ScheduledNote = typeof scheduledNotes.$inferSelect;
export type NewScheduledNote = typeof scheduledNotes.$inferInsert;
export type FileSource = "user" | "system";
