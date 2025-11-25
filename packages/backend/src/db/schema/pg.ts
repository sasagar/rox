import { pgTable, text, timestamp, boolean, integer, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core';

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
