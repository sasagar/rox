import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

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
  /** Preferred language for notifications and emails */
  language?: "en" | "ja";
  /** Disabled push notification types (empty = all enabled) */
  disabledPushNotificationTypes?: NotificationType[];
}

/**
 * Role policies structure (Misskey-style)
 * Defines permissions and limits that can be controlled by roles
 */
export interface RolePolicies {
  // Timeline access
  canViewGlobalTimeline?: boolean;
  canViewLocalTimeline?: boolean;

  // Note creation
  canPublicNote?: boolean;
  canCreateNote?: boolean;

  // Invitations
  canInvite?: boolean;
  inviteLimit?: number; // -1 for unlimited
  inviteLimitCycle?: number; // Hours between limit resets

  // Rate limits (multiplier, 1.0 = default)
  rateLimitFactor?: number;

  // Drive/storage
  driveCapacityMb?: number;
  maxFileSizeMb?: number;

  // Storage quota management
  canManageStorageQuotas?: boolean; // Permission to change user/role storage quotas

  // File management
  canViewSystemAcquiredFiles?: boolean; // Moderator permission to view system-acquired files

  // Scheduled notes
  maxScheduledNotes?: number; // Maximum concurrent scheduled notes, -1 = unlimited, 0 = disabled

  // Moderation permissions
  canManageReports?: boolean;
  canDeleteNotes?: boolean;
  canSuspendUsers?: boolean;

  // Contact/inquiry management
  canManageContacts?: boolean;

  // Instance management (admin only)
  canManageRoles?: boolean;
  canManageInstanceSettings?: boolean;
  canManageInstanceBlocks?: boolean;
  canManageUsers?: boolean;
  canManageCustomEmojis?: boolean;
}

// Users table
export const users = pgTable(
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
    isAdmin: boolean("is_admin").notNull().default(false),
    isSuspended: boolean("is_suspended").notNull().default(false),
    // Soft delete fields for account deletion
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at"),
    // System account flag (for server-level operations)
    isSystemUser: boolean("is_system_user").notNull().default(false),
    publicKey: text("public_key"),
    privateKey: text("private_key"),
    host: text("host"), // null for local users
    // ActivityPub fields
    inbox: text("inbox"),
    outbox: text("outbox"),
    followersUrl: text("followers_url"),
    followingUrl: text("following_url"),
    uri: text("uri"), // ActivityPub actor URI (for remote users)
    sharedInbox: text("shared_inbox"), // Shared inbox URL (for remote users, optional)
    // Account migration (ActivityPub Move)
    alsoKnownAs: jsonb("also_known_as").$type<string[]>().default([]), // Alternative account URIs
    movedTo: text("moved_to"), // URI of account this user moved to
    movedAt: timestamp("moved_at"), // When migration was completed
    // User customization
    customCss: text("custom_css"), // User's custom CSS for profile page
    uiSettings: jsonb("ui_settings").$type<UISettings>(), // User's UI preferences
    // Profile emojis (for remote users - custom emojis in name/bio)
    profileEmojis: jsonb("profile_emojis").$type<ProfileEmoji[]>().default([]),
    // Storage quota override (null = use role default, -1 = unlimited)
    storageQuotaMb: integer("storage_quota_mb"),
    // Follower/following counts (cached for performance)
    followersCount: integer("followers_count").notNull().default(0),
    followingCount: integer("following_count").notNull().default(0),
    // Remote actor fetch status (for detecting 410 Gone)
    goneDetectedAt: timestamp("gone_detected_at"), // First detection of 410 Gone
    fetchFailureCount: integer("fetch_failure_count").notNull().default(0), // Consecutive fetch failures
    lastFetchAttemptAt: timestamp("last_fetch_attempt_at"), // Last fetch attempt timestamp
    lastFetchError: text("last_fetch_error"), // Last error message (e.g., "410 Gone", "404 Not Found")
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    usernameHostIdx: uniqueIndex("username_host_idx").on(table.username, table.host),
    emailIdx: uniqueIndex("email_idx").on(table.email),
    uriIdx: index("uri_idx").on(table.uri),
    isDeletedIdx: index("user_is_deleted_idx").on(table.isDeleted),
    goneDetectedIdx: index("user_gone_detected_idx").on(table.goneDetectedAt),
  }),
);

// Sessions table
export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    userAgent: text("user_agent"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex("token_idx").on(table.token),
    userIdIdx: index("session_user_id_idx").on(table.userId),
  }),
);

// Passkey credentials table for WebAuthn authentication
export const passkeyCredentials = pgTable(
  "passkey_credentials",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    credentialId: text("credential_id").notNull().unique(), // WebAuthn credential ID (base64url)
    publicKey: text("public_key").notNull(), // COSE public key (base64url)
    counter: integer("counter").notNull().default(0), // Signature counter for replay attack prevention
    deviceType: text("device_type"), // 'singleDevice' or 'multiDevice'
    backedUp: boolean("backed_up").notNull().default(false), // Whether credential is backed up (sync passkey)
    transports: jsonb("transports").$type<string[]>().default([]), // WebAuthn transports (usb, ble, nfc, internal)
    name: text("name"), // User-friendly name for the credential
    createdAt: timestamp("created_at").notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => ({
    credentialIdIdx: uniqueIndex("passkey_credential_id_idx").on(table.credentialId),
    userIdIdx: index("passkey_user_id_idx").on(table.userId),
  }),
);

// Passkey authentication challenges (temporary storage for WebAuthn flow)
export const passkeyChallenges = pgTable(
  "passkey_challenges",
  {
    id: text("id").primaryKey(),
    challenge: text("challenge").notNull().unique(), // Random challenge (base64url)
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }), // null for authentication, set for registration
    type: text("type").notNull(), // 'registration' or 'authentication'
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    challengeIdx: uniqueIndex("passkey_challenge_idx").on(table.challenge),
    expiresAtIdx: index("passkey_challenge_expires_idx").on(table.expiresAt),
  }),
);

// Type exports for passkey tables
export type PasskeyCredential = typeof passkeyCredentials.$inferSelect;
export type NewPasskeyCredential = typeof passkeyCredentials.$inferInsert;
export type PasskeyChallenge = typeof passkeyChallenges.$inferSelect;
export type NewPasskeyChallenge = typeof passkeyChallenges.$inferInsert;

// OAuth accounts table for external authentication providers
export const oauthAccounts = pgTable(
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
    tokenExpiresAt: timestamp("token_expires_at"), // When access token expires
    scope: text("scope"), // Granted scopes
    tokenType: text("token_type"), // Usually 'Bearer'
    providerUsername: text("provider_username"), // Username on the provider (for display)
    providerEmail: text("provider_email"), // Email from provider (may differ from user.email)
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

// Type exports for OAuth tables
export type OAuthAccount = typeof oauthAccounts.$inferSelect;
export type NewOAuthAccount = typeof oauthAccounts.$inferInsert;

// Notes table
export const notes = pgTable(
  "notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    text: text("text"),
    cw: text("cw"), // Content Warning
    visibility: text("visibility").notNull().default("public"), // public, home, followers, specified
    localOnly: boolean("local_only").notNull().default(false),
    replyId: text("reply_id"),
    renoteId: text("renote_id"),
    fileIds: jsonb("file_ids").$type<string[]>().notNull().default([]),
    mentions: jsonb("mentions").$type<string[]>().notNull().default([]),
    emojis: jsonb("emojis").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    uri: text("uri"), // ActivityPub URI for remote notes
    // Counters for replies and renotes
    repliesCount: integer("replies_count").notNull().default(0),
    renoteCount: integer("renote_count").notNull().default(0),
    // Soft delete fields for moderation
    isDeleted: boolean("is_deleted").notNull().default(false),
    deletedAt: timestamp("deleted_at"),
    deletedById: text("deleted_by_id").references(() => users.id, { onDelete: "set null" }), // Moderator who deleted
    deletionReason: text("deletion_reason"), // Reason for moderation deletion
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("note_user_id_idx").on(table.userId),
    createdAtIdx: index("note_created_at_idx").on(table.createdAt),
    replyIdIdx: index("note_reply_id_idx").on(table.replyId),
    renoteIdIdx: index("note_renote_id_idx").on(table.renoteId),
    uriIdx: uniqueIndex("note_uri_idx").on(table.uri),
    // Composite indexes for timeline queries
    userTimelineIdx: index("note_user_timeline_idx").on(table.userId, table.createdAt),
    localTimelineIdx: index("note_local_timeline_idx").on(
      table.visibility,
      table.localOnly,
      table.createdAt,
    ),
    // Index for soft delete queries
    isDeletedIdx: index("note_is_deleted_idx").on(table.isDeleted),
  }),
);;

/**
 * File source type
 * - "user": Files uploaded by the user
 * - "system": Files acquired by the system (e.g., fetched from remote servers)
 */
export type FileSource = "user" | "system";

// Drive folders table
export const driveFolders = pgTable(
  "drive_folders",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentId: text("parent_id"), // Self-referencing for nested folders
    name: text("name").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("folder_user_id_idx").on(table.userId),
    parentIdIdx: index("folder_parent_id_idx").on(table.parentId),
  }),
);

// Drive files table
export const driveFiles = pgTable(
  "drive_files",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    folderId: text("folder_id").references(() => driveFolders.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    type: text("type").notNull(), // MIME type
    size: integer("size").notNull(),
    md5: text("md5").notNull(),
    url: text("url").notNull(),
    thumbnailUrl: text("thumbnail_url"),
    blurhash: text("blurhash"),
    comment: text("comment"),
    isSensitive: boolean("is_sensitive").notNull().default(false),
    storageKey: text("storage_key").notNull(), // Internal storage identifier
    source: text("source").notNull().default("user").$type<FileSource>(), // "user" | "system"
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("file_user_id_idx").on(table.userId),
    folderIdIdx: index("file_folder_id_idx").on(table.folderId),
    md5Idx: index("file_md5_idx").on(table.md5),
    sourceIdx: index("file_source_idx").on(table.source),
  }),
);

// Reactions table
export const reactions = pgTable(
  "reactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    noteId: text("note_id")
      .notNull()
      .references(() => notes.id, { onDelete: "cascade" }),
    reaction: text("reaction").notNull(), // Emoji name or Unicode emoji
    customEmojiUrl: text("custom_emoji_url"), // URL for custom emoji image (for remote reactions)
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
export const follows = pgTable(
  "follows",
  {
    id: text("id").primaryKey(),
    followerId: text("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followeeId: text("followee_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

// Received Activities table (for deduplication)
export const receivedActivities = pgTable(
  "received_activities",
  {
    activityId: text("activity_id").primaryKey(),
    receivedAt: timestamp("received_at").notNull().defaultNow(),
  },
  (table) => ({
    receivedAtIdx: index("received_activities_received_at_idx").on(table.receivedAt),
  }),
);

// Instance blocks table (for federation moderation)
export const instanceBlocks = pgTable(
  "instance_blocks",
  {
    id: text("id").primaryKey(),
    host: text("host").notNull().unique(), // Blocked instance hostname (e.g., "spam.instance.com")
    reason: text("reason"), // Optional reason for the block
    blockedById: text("blocked_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }), // Admin who created the block
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    hostIdx: uniqueIndex("instance_block_host_idx").on(table.host),
  }),
);

// Invitation codes table (for invite-only registration)
export const invitationCodes = pgTable(
  "invitation_codes",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(), // The invitation code itself
    createdById: text("created_by_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // User who created the code
    usedById: text("used_by_id").references(() => users.id, { onDelete: "set null" }), // User who used the code (null if unused)
    usedAt: timestamp("used_at"), // When the code was used
    expiresAt: timestamp("expires_at"), // Optional expiration date
    maxUses: integer("max_uses").default(1), // Maximum number of times the code can be used
    useCount: integer("use_count").notNull().default(0), // Current use count
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: uniqueIndex("invitation_code_idx").on(table.code),
    createdByIdx: index("invitation_created_by_idx").on(table.createdById),
  }),
);

// Roles table (Misskey-style role system)
export const roles = pgTable(
  "roles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),
    color: text("color"), // Hex color for UI display (e.g., "#ff0000")
    iconUrl: text("icon_url"), // Optional icon URL
    displayOrder: integer("display_order").notNull().default(0),
    isPublic: boolean("is_public").notNull().default(false), // Show on user profiles
    isDefault: boolean("is_default").notNull().default(false), // Auto-assign to new users
    isAdminRole: boolean("is_admin_role").notNull().default(false), // Full admin access
    isModeratorRole: boolean("is_moderator_role").notNull().default(false), // Moderation access
    policies: jsonb("policies").$type<RolePolicies>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex("role_name_idx").on(table.name),
    displayOrderIdx: index("role_display_order_idx").on(table.displayOrder),
  }),
);

// Role assignments table (user-role relationships)
export const roleAssignments = pgTable(
  "role_assignments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    roleId: text("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at"), // Optional expiry for temporary roles
    assignedById: text("assigned_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userRoleIdx: uniqueIndex("role_assignment_user_role_idx").on(table.userId, table.roleId),
    userIdx: index("role_assignment_user_idx").on(table.userId),
    roleIdx: index("role_assignment_role_idx").on(table.roleId),
  }),
);

// Instance settings table (key-value store for instance configuration)
export const instanceSettings = pgTable("instance_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedById: text("updated_by_id").references(() => users.id, { onDelete: "set null" }),
});

// User reports table (for moderation)
export const userReports = pgTable(
  "user_reports",
  {
    id: text("id").primaryKey(),
    reporterId: text("reporter_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // User who reported
    targetUserId: text("target_user_id").references(() => users.id, { onDelete: "set null" }), // Reported user (null if report is about a note only)
    targetNoteId: text("target_note_id").references(() => notes.id, { onDelete: "set null" }), // Reported note (optional)
    reason: text("reason").notNull(), // Report reason/category
    comment: text("comment"), // Additional details from reporter
    status: text("status").notNull().default("pending"), // pending, resolved, rejected
    resolvedById: text("resolved_by_id").references(() => users.id, { onDelete: "set null" }), // Admin who resolved
    resolvedAt: timestamp("resolved_at"),
    resolution: text("resolution"), // Admin's resolution note
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    reporterIdx: index("report_reporter_idx").on(table.reporterId),
    targetUserIdx: index("report_target_user_idx").on(table.targetUserId),
    targetNoteIdx: index("report_target_note_idx").on(table.targetNoteId),
    statusIdx: index("report_status_idx").on(table.status),
    createdAtIdx: index("report_created_at_idx").on(table.createdAt),
  }),
);

// Moderation audit log table (tracks all moderation actions)
export const moderationAuditLogs = pgTable(
  "moderation_audit_logs",
  {
    id: text("id").primaryKey(),
    moderatorId: text("moderator_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }), // Moderator who performed the action
    action: text("action").notNull(), // Action type: delete_note, suspend_user, unsuspend_user, resolve_report, etc.
    targetType: text("target_type").notNull(), // note, user, report
    targetId: text("target_id").notNull(), // ID of the target (note/user/report)
    reason: text("reason"), // Reason for the action
    details: jsonb("details").$type<Record<string, unknown>>(), // Additional details (e.g., original content for deleted notes)
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    moderatorIdx: index("audit_moderator_idx").on(table.moderatorId),
    actionIdx: index("audit_action_idx").on(table.action),
    targetTypeIdx: index("audit_target_type_idx").on(table.targetType),
    targetIdIdx: index("audit_target_id_idx").on(table.targetId),
    createdAtIdx: index("audit_created_at_idx").on(table.createdAt),
  }),
);

// User warnings table (tracks warnings issued to users)
export const userWarnings = pgTable(
  "user_warnings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // User who received the warning
    moderatorId: text("moderator_id")
      .notNull()
      .references(() => users.id, { onDelete: "set null" }), // Moderator who issued the warning
    reason: text("reason").notNull(), // Reason for the warning
    isRead: boolean("is_read").notNull().default(false), // Whether the user has acknowledged the warning
    readAt: timestamp("read_at"), // When the user acknowledged the warning
    expiresAt: timestamp("expires_at"), // Optional expiration date (null = permanent record)
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("warning_user_idx").on(table.userId),
    moderatorIdx: index("warning_moderator_idx").on(table.moderatorId),
    isReadIdx: index("warning_is_read_idx").on(table.isRead),
    createdAtIdx: index("warning_created_at_idx").on(table.createdAt),
  }),
);

// Custom emojis table (instance-level custom emojis)
export const customEmojis = pgTable(
  "custom_emojis",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(), // Emoji shortcode without colons (e.g., 'blob_cat')
    host: text("host"), // null for local, domain for remote
    category: text("category"), // Optional category for organization
    aliases: jsonb("aliases").$type<string[]>().notNull().default([]), // Alternative names
    url: text("url").notNull(), // Image URL
    publicUrl: text("public_url"), // Public URL for external access
    license: text("license"), // License information
    isSensitive: boolean("is_sensitive").notNull().default(false), // NSFW flag
    localOnly: boolean("local_only").notNull().default(false), // Don't federate
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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
  | "quote"
  | "dm";

// Notifications table
export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // User who receives the notification
    type: text("type").notNull().$type<NotificationType>(), // Type of notification
    notifierId: text("notifier_id").references(() => users.id, { onDelete: "cascade" }), // User who triggered the notification (null for system notifications)
    noteId: text("note_id").references(() => notes.id, { onDelete: "cascade" }), // Related note (for mention, reply, reaction, renote, quote)
    reaction: text("reaction"), // Reaction emoji (for reaction notifications)
    warningId: text("warning_id").references(() => userWarnings.id, { onDelete: "cascade" }), // Related warning (for warning notifications)
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
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

// Push subscriptions table (Web Push API)
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // User who owns this subscription
    endpoint: text("endpoint").notNull(), // Push service endpoint URL
    p256dh: text("p256dh").notNull(), // Client public key for encryption
    auth: text("auth").notNull(), // Auth secret for encryption
    userAgent: text("user_agent"), // Browser/device info for management
    language: text("language"), // User's preferred language for notifications (en, ja)
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("push_subscription_user_id_idx").on(table.userId),
    endpointIdx: uniqueIndex("push_subscription_endpoint_idx").on(table.endpoint),
  }),
);

// Remote instances table (caches information about federated servers)
export const remoteInstances = pgTable(
  "remote_instances",
  {
    host: text("host").primaryKey(), // Domain of the remote instance (e.g., "misskey.io")
    softwareName: text("software_name"), // Software name (e.g., "misskey", "mastodon", "gotosocial")
    softwareVersion: text("software_version"), // Software version
    name: text("name"), // Instance name
    description: text("description"), // Instance description
    iconUrl: text("icon_url"), // Instance icon/favicon URL
    themeColor: text("theme_color"), // Theme color (hex code like "#86b300")
    openRegistrations: boolean("open_registrations"), // Whether registrations are open
    usersCount: integer("users_count"), // Number of users
    notesCount: integer("notes_count"), // Number of posts/notes
    isBlocked: boolean("is_blocked").notNull().default(false), // Whether this instance is blocked
    lastFetchedAt: timestamp("last_fetched_at"), // When info was last fetched
    fetchErrorCount: integer("fetch_error_count").notNull().default(0), // Number of consecutive fetch errors
    lastFetchError: text("last_fetch_error"), // Last fetch error message
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
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

// Scheduled notes table (for delayed posting)
export const scheduledNotes = pgTable(
  "scheduled_notes",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Note content (same as notes table)
    text: text("text"),
    cw: text("cw"), // Content Warning
    visibility: text("visibility").notNull().default("public"), // public, home, followers, specified
    localOnly: boolean("local_only").notNull().default(false),
    replyId: text("reply_id"),
    renoteId: text("renote_id"),
    fileIds: jsonb("file_ids").$type<string[]>().notNull().default([]),
    // Schedule info
    scheduledAt: timestamp("scheduled_at").notNull(), // When to publish
    status: text("status").notNull().default("pending").$type<ScheduledNoteStatus>(), // pending, published, failed, cancelled
    publishedNoteId: text("published_note_id").references(() => notes.id, { onDelete: "set null" }), // ID of created note after publishing
    errorMessage: text("error_message"), // Error if publication failed
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index("scheduled_note_user_id_idx").on(table.userId),
    scheduledAtIdx: index("scheduled_note_scheduled_at_idx").on(table.scheduledAt),
    statusIdx: index("scheduled_note_status_idx").on(table.status),
    // Composite for efficient queue processing
    pendingScheduleIdx: index("scheduled_note_pending_schedule_idx").on(
      table.status,
      table.scheduledAt,
    ),
  }),
);

/**
 * Contact thread status
 */
export type ContactThreadStatus = "open" | "in_progress" | "resolved" | "closed";

/**
 * Contact message sender type
 */
export type ContactSenderType = "user" | "admin" | "moderator";

// Contact threads table (one per inquiry)
export const contactThreads = pgTable(
  "contact_threads",
  {
    id: text("id").primaryKey(),
    // User who created the inquiry (null for anonymous/guest inquiries)
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    // Subject/title of the inquiry
    subject: text("subject").notNull(),
    // Category for organization (general, bug, feature, abuse, account, etc.)
    category: text("category").notNull().default("general"),
    // Current status
    status: text("status").notNull().default("open").$type<ContactThreadStatus>(),
    // Email for non-logged-in users or notification purposes
    email: text("email"),
    // Assigned staff member (for internal tracking, not shown to user)
    assignedToId: text("assigned_to_id").references(() => users.id, { onDelete: "set null" }),
    // Priority level (1 = low, 2 = normal, 3 = high, 4 = urgent)
    priority: integer("priority").notNull().default(2),
    // Internal notes (only visible to staff)
    internalNotes: text("internal_notes"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    // When the thread was resolved/closed
    closedAt: timestamp("closed_at"),
  },
  (table) => ({
    userIdIdx: index("contact_thread_user_id_idx").on(table.userId),
    statusIdx: index("contact_thread_status_idx").on(table.status),
    categoryIdx: index("contact_thread_category_idx").on(table.category),
    createdAtIdx: index("contact_thread_created_at_idx").on(table.createdAt),
    assignedToIdx: index("contact_thread_assigned_to_idx").on(table.assignedToId),
  }),
);

// Contact messages table (messages within a thread)
export const contactMessages = pgTable(
  "contact_messages",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => contactThreads.id, { onDelete: "cascade" }),
    // Who sent the message (user ID for users, staff ID for staff)
    senderId: text("sender_id").references(() => users.id, { onDelete: "set null" }),
    // Type of sender (for display purposes - staff shown as "admin" or "moderator")
    senderType: text("sender_type").notNull().$type<ContactSenderType>(),
    // Message content
    content: text("content").notNull(),
    // Whether this message has been read by the recipient
    isRead: boolean("is_read").notNull().default(false),
    // Attached file IDs (for screenshots, etc.)
    attachmentIds: jsonb("attachment_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    threadIdIdx: index("contact_message_thread_id_idx").on(table.threadId),
    senderIdIdx: index("contact_message_sender_id_idx").on(table.senderId),
    createdAtIdx: index("contact_message_created_at_idx").on(table.createdAt),
  }),
);

/**
 * Blocked usernames table
 * Stores admin-configurable username restrictions (patterns or exact matches)
 * Used in conjunction with DEFAULT_RESERVED_USERNAMES from shared constants
 */
export const blockedUsernames = pgTable(
  "blocked_usernames",
  {
    id: text("id").primaryKey(),
    // Username pattern (exact string or regex)
    pattern: text("pattern").notNull(),
    // Whether pattern is a regex (false = exact match)
    isRegex: boolean("is_regex").notNull().default(false),
    // Optional reason for blocking (shown in admin UI)
    reason: text("reason"),
    // Admin who created this block
    createdById: text("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    patternIdx: uniqueIndex("blocked_username_pattern_idx").on(table.pattern),
  }),
);

/**
 * User lists table
 * Stores user-created lists for organizing followed users (Twitter/X-like lists)
 */
export const userLists = pgTable(
  "user_lists",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isPublic: boolean("is_public").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userIdx: index("user_list_user_idx").on(table.userId),
    userNameIdx: uniqueIndex("user_list_user_name_idx").on(table.userId, table.name),
  }),
);

/**
 * User list members table
 * Stores membership relationships between users and lists
 */
export const userListMembers = pgTable(
  "user_list_members",
  {
    id: text("id").primaryKey(),
    listId: text("list_id")
      .notNull()
      .references(() => userLists.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // Whether to include replies from this member in list timeline
    withReplies: boolean("with_replies").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    listUserIdx: uniqueIndex("user_list_member_list_user_idx").on(table.listId, table.userId),
    listIdx: index("user_list_member_list_idx").on(table.listId),
    userIdx: index("user_list_member_user_idx").on(table.userId),
  }),
);

// Export types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
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
export type ContactThread = typeof contactThreads.$inferSelect;
export type NewContactThread = typeof contactThreads.$inferInsert;
export type ContactMessage = typeof contactMessages.$inferSelect;
export type NewContactMessage = typeof contactMessages.$inferInsert;
export type BlockedUsername = typeof blockedUsernames.$inferSelect;
export type NewBlockedUsername = typeof blockedUsernames.$inferInsert;
export type UserList = typeof userLists.$inferSelect;
export type NewUserList = typeof userLists.$inferInsert;
export type UserListMember = typeof userListMembers.$inferSelect;
export type NewUserListMember = typeof userListMembers.$inferInsert;
