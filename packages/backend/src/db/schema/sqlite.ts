/**
 * SQLite/D1 Database Schema
 *
 * This schema is designed to work with both local SQLite (via better-sqlite3)
 * and Cloudflare D1 (via drizzle-orm/d1).
 *
 * Key differences from PostgreSQL:
 * - Uses `integer` with `{ mode: 'timestamp' }` instead of `timestamp`
 * - Uses `text` with JSON.stringify for JSON fields (no native JSONB)
 * - No `serial` type, uses `integer` with autoincrement via primary key
 *
 * @module db/schema/sqlite
 */

import { sqliteTable, text, integer, index, uniqueIndex } from "drizzle-orm/sqlite-core";

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
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name"),
    bio: text("bio"),
    avatarUrl: text("avatar_url"),
    bannerUrl: text("banner_url"),
    isAdmin: integer("is_admin", { mode: "boolean" }).notNull().default(false),
    isSuspended: integer("is_suspended", { mode: "boolean" }).notNull().default(false),
    // Soft delete fields for account deletion
    isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    publicKey: text("public_key"),
    privateKey: text("private_key"),
    host: text("host"),
    inbox: text("inbox"),
    outbox: text("outbox"),
    followersUrl: text("followers_url"),
    followingUrl: text("following_url"),
    uri: text("uri"),
    sharedInbox: text("shared_inbox"),
    alsoKnownAs: text("also_known_as", { mode: "json" }).$type<string[]>().default([]),
    movedTo: text("moved_to"),
    movedAt: integer("moved_at", { mode: "timestamp" }),
    customCss: text("custom_css"),
    uiSettings: text("ui_settings", { mode: "json" }).$type<UISettings>(),
    profileEmojis: text("profile_emojis", { mode: "json" }).$type<ProfileEmoji[]>().default([]),
    storageQuotaMb: integer("storage_quota_mb"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
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
export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    tokenIdx: uniqueIndex("token_idx").on(table.token),
    userIdIdx: index("session_user_id_idx").on(table.userId),
  }),
);

// Passkey credentials table
export const passkeyCredentials = sqliteTable(
  "passkey_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull().unique(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    deviceType: text("device_type"),
    backedUp: integer("backed_up", { mode: "boolean" }).notNull().default(false),
    transports: text("transports", { mode: "json" }).$type<string[]>().default([]),
    name: text("name"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  },
  (table) => ({
    credentialIdIdx: uniqueIndex("passkey_credential_id_idx").on(table.credentialId),
    userIdIdx: index("passkey_user_id_idx").on(table.userId),
  }),
);

// Passkey challenges table
export const passkeyChallenges = sqliteTable(
  "passkey_challenges",
  {
    id: text("id").primaryKey(),
    challenge: text("challenge").notNull().unique(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    challengeIdx: uniqueIndex("passkey_challenge_idx").on(table.challenge),
    expiresAtIdx: index("passkey_challenge_expires_idx").on(table.expiresAt),
  }),
);

// OAuth accounts table for external authentication providers
export const oauthAccounts = sqliteTable(
  "oauth_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // 'github', 'google', 'discord', 'mastodon'
    providerAccountId: text("provider_account_id").notNull(), // User ID from the OAuth provider
    accessToken: text("access_token"), // Current access token (may be encrypted)
    refreshToken: text("refresh_token"), // Refresh token if provider supports it
    tokenExpiresAt: integer("token_expires_at", { mode: "timestamp" }), // When access token expires
    scope: text("scope"), // Granted scopes
    tokenType: text("token_type"), // Usually 'Bearer'
    providerUsername: text("provider_username"), // Username on the provider (for display)
    providerEmail: text("provider_email"), // Email from provider (may differ from user.email)
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    // Unique constraint: one provider account per user per provider
    userProviderIdx: uniqueIndex("oauth_user_provider_idx").on(table.userId, table.provider),
    // Unique constraint: each provider account ID is unique per provider
    providerAccountIdx: uniqueIndex("oauth_provider_account_idx").on(
      table.provider,
      table.providerAccountId,
    ),
    userIdIdx: index("oauth_user_id_idx").on(table.userId),
  }),
);

// Notes table
export const notes = sqliteTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text"),
    cw: text("cw"),
    visibility: text("visibility").notNull().default("public"),
    localOnly: integer("local_only", { mode: "boolean" }).notNull().default(false),
    replyId: text("reply_id"),
    renoteId: text("renote_id"),
    fileIds: text("file_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
    mentions: text("mentions", { mode: "json" }).$type<string[]>().notNull().default([]),
    emojis: text("emojis", { mode: "json" }).$type<string[]>().notNull().default([]),
    tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
    uri: text("uri"),
    isDeleted: integer("is_deleted", { mode: "boolean" }).notNull().default(false),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
    deletedById: text("deleted_by_id").references(() => users.id, { onDelete: "set null" }),
    deletionReason: text("deletion_reason"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
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
export const driveFolders = sqliteTable(
  "drive_folders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    name: text("name").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("folder_user_id_idx").on(table.userId),
    parentIdIdx: index("folder_parent_id_idx").on(table.parentId),
  }),
);

// Drive files table
export const driveFiles = sqliteTable(
  "drive_files",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => driveFolders.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    type: text("type").notNull(),
    size: integer("size").notNull(),
    md5: text("md5").notNull(),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    blurhash: text("blurhash"),
    comment: text("comment"),
    isSensitive: integer("is_sensitive", { mode: "boolean" }).notNull().default(false),
    storageKey: text("storage_key").notNull(),
    source: text("source").notNull().default("user"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
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
export const reactions = sqliteTable(
  "reactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    reaction: text("reaction").notNull(),
    customEmojiUrl: text("custom_emoji_url"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
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
export const follows = sqliteTable(
  "follows",
  {
    id: text("id").primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
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
export const receivedActivities = sqliteTable(
  "received_activities",
  {
    activityId: text("activity_id").primaryKey(),
    receivedAt: integer("received_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    receivedAtIdx: index("received_activities_received_at_idx").on(table.receivedAt),
  }),
);

// Instance blocks table
export const instanceBlocks = sqliteTable(
  "instance_blocks",
  {
    id: text("id").primaryKey(),
    host: text("host").notNull().unique(),
    reason: text("reason"),
    blockedById: text("blocked_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    hostIdx: uniqueIndex("instance_block_host_idx").on(table.host),
  }),
);

// Invitation codes table
export const invitationCodes = sqliteTable(
  "invitation_codes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    usedById: text("used_by_id").references(() => users.id, { onDelete: "set null" }),
    usedAt: integer("used_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    maxUses: integer("max_uses").default(1),
    useCount: integer("use_count").notNull().default(0),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    codeIdx: uniqueIndex("invitation_code_idx").on(table.code),
    createdByIdx: index("invitation_created_by_idx").on(table.createdById),
  }),
);

// Roles table
export const roles = sqliteTable(
  "roles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),
    color: text("color"),
    iconUrl: text("icon_url"),
    displayOrder: integer("display_order").notNull().default(0),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
    isAdminRole: integer("is_admin_role", { mode: "boolean" }).notNull().default(false),
    isModeratorRole: integer("is_moderator_role", { mode: "boolean" }).notNull().default(false),
    policies: text("policies", { mode: "json" }).$type<RolePolicies>().notNull().default({}),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    nameIdx: uniqueIndex("role_name_idx").on(table.name),
    displayOrderIdx: index("role_display_order_idx").on(table.displayOrder),
  }),
);

// Role assignments table
export const roleAssignments = sqliteTable(
  "role_assignments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    assignedById: text("assigned_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: integer("created_at", { mode: "timestamp" })
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
export const instanceSettings = sqliteTable("instance_settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
});

// User reports table
export const userReports = sqliteTable(
  "user_reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }),
    targetNoteId: text("target_note_id").references(() => notes.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    comment: text("comment"),
    status: text("status").notNull().default("pending"),
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
    resolvedAt: integer("resolved_at", { mode: "timestamp" }),
    resolution: text("resolution"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
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
export const moderationAuditLogs = sqliteTable(
  "moderation_audit_logs",
  {
    id: text("id").primaryKey(),
    moderatorId: text("moderator_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    reason: text("reason"),
    details: text("details", { mode: "json" }).$type<Record<string, unknown>>(),
    createdAt: integer("created_at", { mode: "timestamp" })
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
export const userWarnings = sqliteTable(
  "user_warnings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    moderatorId: text("moderator_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }),
    reason: text("reason").notNull(),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    readAt: integer("read_at", { mode: "timestamp" }),
    expiresAt: integer("expires_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
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
export const customEmojis = sqliteTable(
  "custom_emojis",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    host: text("host"),
    category: text("category"),
    aliases: text("aliases", { mode: "json" }).$type<string[]>().notNull().default([]),
    url: text("url").notNull(),
    publicUrl: text("public_url"),
    license: text("license"),
    isSensitive: integer("is_sensitive", { mode: "boolean" }).notNull().default(false),
    localOnly: integer("local_only", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
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
export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull().$type<NotificationType>(),
    notifierId: text("notifier_id").references(() => users.id, { onDelete: "cascade" }),
    noteId: text("note_id").references(() => notes.id, { onDelete: "cascade" }),
    reaction: text("reaction"),
    warningId: text("warning_id").references(() => userWarnings.id, { onDelete: "cascade" }),
    isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
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
export const pushSubscriptions = sqliteTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => ({
    userIdIdx: index("push_subscription_user_id_idx").on(table.userId),
    endpointIdx: uniqueIndex("push_subscription_endpoint_idx").on(table.endpoint),
  }),
);

// Remote instances table
export const remoteInstances = sqliteTable(
  "remote_instances",
  {
    host: text("host").primaryKey(),
    softwareName: text("software_name"),
    softwareVersion: text("software_version"),
    name: text("name"),
    description: text("description"),
    iconUrl: text("icon_url"),
    themeColor: text("theme_color"),
    openRegistrations: integer("open_registrations", { mode: "boolean" }),
    usersCount: integer("users_count"),
    notesCount: integer("notes_count"),
    isBlocked: integer("is_blocked", { mode: "boolean" }).notNull().default(false),
    lastFetchedAt: integer("last_fetched_at", { mode: "timestamp" }),
    fetchErrorCount: integer("fetch_error_count").notNull().default(0),
    lastFetchError: text("last_fetch_error"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
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
export const scheduledNotes = sqliteTable(
  "scheduled_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text"),
    cw: text("cw"),
    visibility: text("visibility").notNull().default("public"),
    localOnly: integer("local_only", { mode: "boolean" }).notNull().default(false),
    replyId: text("reply_id"),
    renoteId: text("renote_id"),
    fileIds: text("file_ids", { mode: "json" }).$type<string[]>().notNull().default([]),
    scheduledAt: integer("scheduled_at", { mode: "timestamp" }).notNull(),
    status: text("status").notNull().default("pending").$type<ScheduledNoteStatus>(),
    publishedNoteId: text("published_note_id").references(() => notes.id, { onDelete: "set null" }),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .$defaultFn(() => new Date()),
    updatedAt: integer("updated_at", { mode: "timestamp" })
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
