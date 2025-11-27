import { pgTable, text, timestamp, boolean, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

/**
 * User UI settings structure
 * Allows users to customize their viewing experience
 */
export interface UISettings {
  /** Font size: 'small' (12px), 'medium' (14px), 'large' (16px), 'xlarge' (18px) */
  fontSize?: 'small' | 'medium' | 'large' | 'xlarge';
  /** Line height: 'compact' (1.4), 'normal' (1.6), 'relaxed' (1.8) */
  lineHeight?: 'compact' | 'normal' | 'relaxed';
  /** Content width: 'narrow' (600px), 'normal' (800px), 'wide' (1000px) */
  contentWidth?: 'narrow' | 'normal' | 'wide';
  /** Theme: 'light', 'dark', 'system' */
  theme?: 'light' | 'dark' | 'system';
  /** Custom CSS applied to the entire app (for this user only) */
  appCustomCss?: string;
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

  // Moderation permissions
  canManageReports?: boolean;
  canDeleteNotes?: boolean;
  canSuspendUsers?: boolean;

  // Instance management (admin only)
  canManageRoles?: boolean;
  canManageInstanceSettings?: boolean;
  canManageInstanceBlocks?: boolean;
  canManageUsers?: boolean;
  canManageCustomEmojis?: boolean;
}

// Users table
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    username: text('username').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name'),
    bio: text('bio'),
    avatarUrl: text('avatar_url'),
    bannerUrl: text('banner_url'),
    isAdmin: boolean('is_admin').notNull().default(false),
    isSuspended: boolean('is_suspended').notNull().default(false),
    publicKey: text('public_key'),
    privateKey: text('private_key'),
    host: text('host'), // null for local users
    // ActivityPub fields
    inbox: text('inbox'),
    outbox: text('outbox'),
    followersUrl: text('followers_url'),
    followingUrl: text('following_url'),
    uri: text('uri'), // ActivityPub actor URI (for remote users)
    sharedInbox: text('shared_inbox'), // Shared inbox URL (for remote users, optional)
    // User customization
    customCss: text('custom_css'), // User's custom CSS for profile page
    uiSettings: jsonb('ui_settings').$type<UISettings>(), // User's UI preferences
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    usernameHostIdx: uniqueIndex('username_host_idx').on(table.username, table.host),
    emailIdx: uniqueIndex('email_idx').on(table.email),
    uriIdx: index('uri_idx').on(table.uri),
  })
);

// Sessions table
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: timestamp('expires_at').notNull(),
    userAgent: text('user_agent'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    tokenIdx: uniqueIndex('token_idx').on(table.token),
    userIdIdx: index('session_user_id_idx').on(table.userId),
  })
);

// Notes table
export const notes = pgTable(
  'notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    text: text('text'),
    cw: text('cw'), // Content Warning
    visibility: text('visibility').notNull().default('public'), // public, home, followers, specified
    localOnly: boolean('local_only').notNull().default(false),
    replyId: text('reply_id'),
    renoteId: text('renote_id'),
    fileIds: jsonb('file_ids').$type<string[]>().notNull().default([]),
    mentions: jsonb('mentions').$type<string[]>().notNull().default([]),
    emojis: jsonb('emojis').$type<string[]>().notNull().default([]),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    uri: text('uri'), // ActivityPub URI for remote notes
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('note_user_id_idx').on(table.userId),
    createdAtIdx: index('note_created_at_idx').on(table.createdAt),
    replyIdIdx: index('note_reply_id_idx').on(table.replyId),
    renoteIdIdx: index('note_renote_id_idx').on(table.renoteId),
    uriIdx: uniqueIndex('note_uri_idx').on(table.uri),
    // Composite indexes for timeline queries
    userTimelineIdx: index('note_user_timeline_idx').on(table.userId, table.createdAt),
    localTimelineIdx: index('note_local_timeline_idx').on(table.visibility, table.localOnly, table.createdAt),
  })
);

// Drive files table
export const driveFiles = pgTable(
  'drive_files',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    type: text('type').notNull(), // MIME type
    size: integer('size').notNull(),
    md5: text('md5').notNull(),
    url: text('url').notNull(),
    thumbnailUrl: text('thumbnail_url'),
    blurhash: text('blurhash'),
    comment: text('comment'),
    isSensitive: boolean('is_sensitive').notNull().default(false),
    storageKey: text('storage_key').notNull(), // Internal storage identifier
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('file_user_id_idx').on(table.userId),
    md5Idx: index('file_md5_idx').on(table.md5),
  })
);

// Reactions table
export const reactions = pgTable(
  'reactions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    noteId: text('note_id')
      .notNull()
      .references(() => notes.id, { onDelete: 'cascade' }),
    reaction: text('reaction').notNull(), // Emoji name or Unicode emoji
    customEmojiUrl: text('custom_emoji_url'), // URL for custom emoji image (for remote reactions)
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    userNoteReactionIdx: uniqueIndex('reaction_user_note_reaction_idx').on(
      table.userId,
      table.noteId,
      table.reaction
    ),
    noteIdIdx: index('reaction_note_id_idx').on(table.noteId),
  })
);

// Follows table
export const follows = pgTable(
  'follows',
  {
    id: text('id').primaryKey(),
    followerId: text('follower_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    followeeId: text('followee_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    followerFolloweeIdx: uniqueIndex('follow_follower_followee_idx').on(
      table.followerId,
      table.followeeId
    ),
    followerIdx: index('follow_follower_idx').on(table.followerId),
    followeeIdx: index('follow_followee_idx').on(table.followeeId),
  })
);

// Received Activities table (for deduplication)
export const receivedActivities = pgTable(
  'received_activities',
  {
    activityId: text('activity_id').primaryKey(),
    receivedAt: timestamp('received_at').notNull().defaultNow(),
  },
  (table) => ({
    receivedAtIdx: index('received_activities_received_at_idx').on(table.receivedAt),
  })
);

// Instance blocks table (for federation moderation)
export const instanceBlocks = pgTable(
  'instance_blocks',
  {
    id: text('id').primaryKey(),
    host: text('host').notNull().unique(), // Blocked instance hostname (e.g., "spam.instance.com")
    reason: text('reason'), // Optional reason for the block
    blockedById: text('blocked_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'set null' }), // Admin who created the block
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    hostIdx: uniqueIndex('instance_block_host_idx').on(table.host),
  })
);

// Invitation codes table (for invite-only registration)
export const invitationCodes = pgTable(
  'invitation_codes',
  {
    id: text('id').primaryKey(),
    code: text('code').notNull().unique(), // The invitation code itself
    createdById: text('created_by_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }), // User who created the code
    usedById: text('used_by_id').references(() => users.id, { onDelete: 'set null' }), // User who used the code (null if unused)
    usedAt: timestamp('used_at'), // When the code was used
    expiresAt: timestamp('expires_at'), // Optional expiration date
    maxUses: integer('max_uses').default(1), // Maximum number of times the code can be used
    useCount: integer('use_count').notNull().default(0), // Current use count
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    codeIdx: uniqueIndex('invitation_code_idx').on(table.code),
    createdByIdx: index('invitation_created_by_idx').on(table.createdById),
  })
);

// Roles table (Misskey-style role system)
export const roles = pgTable(
  'roles',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull().unique(),
    description: text('description'),
    color: text('color'), // Hex color for UI display (e.g., "#ff0000")
    iconUrl: text('icon_url'), // Optional icon URL
    displayOrder: integer('display_order').notNull().default(0),
    isPublic: boolean('is_public').notNull().default(false), // Show on user profiles
    isDefault: boolean('is_default').notNull().default(false), // Auto-assign to new users
    isAdminRole: boolean('is_admin_role').notNull().default(false), // Full admin access
    isModeratorRole: boolean('is_moderator_role').notNull().default(false), // Moderation access
    policies: jsonb('policies').$type<RolePolicies>().notNull().default({}),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    nameIdx: uniqueIndex('role_name_idx').on(table.name),
    displayOrderIdx: index('role_display_order_idx').on(table.displayOrder),
  })
);

// Role assignments table (user-role relationships)
export const roleAssignments = pgTable(
  'role_assignments',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    roleId: text('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at'), // Optional expiry for temporary roles
    assignedById: text('assigned_by_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => ({
    userRoleIdx: uniqueIndex('role_assignment_user_role_idx').on(table.userId, table.roleId),
    userIdx: index('role_assignment_user_idx').on(table.userId),
    roleIdx: index('role_assignment_role_idx').on(table.roleId),
  })
);

// Instance settings table (key-value store for instance configuration)
export const instanceSettings = pgTable(
  'instance_settings',
  {
    key: text('key').primaryKey(),
    value: jsonb('value').notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    updatedById: text('updated_by_id').references(() => users.id, { onDelete: 'set null' }),
  }
);

// User reports table (for moderation)
export const userReports = pgTable(
  'user_reports',
  {
    id: text('id').primaryKey(),
    reporterId: text('reporter_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }), // User who reported
    targetUserId: text('target_user_id').references(() => users.id, { onDelete: 'set null' }), // Reported user (null if report is about a note only)
    targetNoteId: text('target_note_id').references(() => notes.id, { onDelete: 'set null' }), // Reported note (optional)
    reason: text('reason').notNull(), // Report reason/category
    comment: text('comment'), // Additional details from reporter
    status: text('status').notNull().default('pending'), // pending, resolved, rejected
    resolvedById: text('resolved_by_id').references(() => users.id, { onDelete: 'set null' }), // Admin who resolved
    resolvedAt: timestamp('resolved_at'),
    resolution: text('resolution'), // Admin's resolution note
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    reporterIdx: index('report_reporter_idx').on(table.reporterId),
    targetUserIdx: index('report_target_user_idx').on(table.targetUserId),
    targetNoteIdx: index('report_target_note_idx').on(table.targetNoteId),
    statusIdx: index('report_status_idx').on(table.status),
    createdAtIdx: index('report_created_at_idx').on(table.createdAt),
  })
);

// Custom emojis table (instance-level custom emojis)
export const customEmojis = pgTable(
  'custom_emojis',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(), // Emoji shortcode without colons (e.g., 'blob_cat')
    host: text('host'), // null for local, domain for remote
    category: text('category'), // Optional category for organization
    aliases: jsonb('aliases').$type<string[]>().notNull().default([]), // Alternative names
    url: text('url').notNull(), // Image URL
    publicUrl: text('public_url'), // Public URL for external access
    license: text('license'), // License information
    isSensitive: boolean('is_sensitive').notNull().default(false), // NSFW flag
    localOnly: boolean('local_only').notNull().default(false), // Don't federate
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => ({
    nameHostIdx: uniqueIndex('emoji_name_host_idx').on(table.name, table.host),
    hostIdx: index('emoji_host_idx').on(table.host),
    categoryIdx: index('emoji_category_idx').on(table.category),
  })
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
