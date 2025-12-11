import { eq, and, or, isNull, inArray, desc, gt, lt, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { notes, users } from "../../db/schema/pg.js";
import type {
  INoteRepository,
  NoteCreateInput,
  TimelineOptions,
} from "../../interfaces/repositories/INoteRepository.js";
import type { Note } from "shared";
import { logger } from "../../lib/logger.js";

export class PostgresNoteRepository implements INoteRepository {
  constructor(private db: Database) {}

  async create(note: NoteCreateInput): Promise<Note> {
    const now = new Date();
    const [result] = await this.db
      .insert(notes)
      .values({
        ...note,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create note");
    }

    return result as Note;
  }

  async findById(id: string): Promise<Note | null> {
    const [result] = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.id, id))
      .limit(1);

    if (!result) {
      return null;
    }

    return {
      ...result.notes,
      user: {
        id: result.users.id,
        username: result.users.username,
        name: result.users.displayName || result.users.username,
        displayName: result.users.displayName,
        avatarUrl: result.users.avatarUrl,
        host: result.users.host,
      },
    } as Note;
  }

  async findByUri(uri: string): Promise<Note | null> {
    const [result] = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(eq(notes.uri, uri))
      .limit(1);

    if (!result) {
      return null;
    }

    return {
      ...result.notes,
      user: {
        id: result.users.id,
        username: result.users.username,
        name: result.users.displayName || result.users.username,
        displayName: result.users.displayName,
        avatarUrl: result.users.avatarUrl,
        host: result.users.host,
      },
    } as Note;
  }

  async getLocalTimeline(options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    // 条件を配列に集める
    const conditions = [
      isNull(users.host), // ローカルユーザーのみ
      eq(notes.visibility, "public"), // 公開投稿のみ
      eq(notes.localOnly, false), // localOnlyでない投稿
      eq(notes.isDeleted, false), // ソフトデリートされていない
    ];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async getTimeline(options: TimelineOptions & { userIds: string[] }): Promise<Note[]> {
    const { limit = 20, sinceId, untilId, userIds } = options;

    if (userIds.length === 0) {
      return [];
    }

    const conditions = [
      inArray(notes.userId, userIds),
      eq(notes.isDeleted, false), // ソフトデリートされていない
    ];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async getSocialTimeline(options: TimelineOptions & { userIds?: string[] }): Promise<Note[]> {
    const { limit = 20, sinceId, untilId, userIds = [] } = options;

    // ソーシャルタイムライン = ローカルの公開投稿 OR フォロー中のリモートユーザーの投稿
    const conditions = [
      eq(notes.isDeleted, false), // ソフトデリートされていない
    ];

    // ローカル公開投稿の条件（localOnlyではない、publicのみ）
    const localConditions = [
      isNull(users.host),
      eq(notes.visibility, "public"),
      eq(notes.localOnly, false),
    ];

    // リモートユーザーの投稿の条件（userIdsに含まれる）
    if (userIds.length > 0) {
      // (ローカル公開投稿) OR (フォロー中のリモートユーザー)
      conditions.push(or(and(...localConditions), inArray(notes.userId, userIds))!);
    } else {
      // フォローなしの場合はローカル公開投稿のみ
      conditions.push(...localConditions);
    }

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async getGlobalTimeline(options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    // グローバルタイムライン = すべての公開投稿（ローカル + リモート）
    const conditions = [
      eq(notes.visibility, "public"), // 公開投稿のみ
      eq(notes.localOnly, false), // localOnlyでない投稿
      eq(notes.isDeleted, false), // ソフトデリートされていない
    ];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async findByUserId(userId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [
      eq(notes.userId, userId),
      eq(notes.isDeleted, false), // ソフトデリートされていない
    ];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async findReplies(noteId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [
      eq(notes.replyId, noteId),
      eq(notes.isDeleted, false), // ソフトデリートされていない
    ];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async findRenotes(noteId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [
      eq(notes.renoteId, noteId),
      eq(notes.isDeleted, false), // ソフトデリートされていない
    ];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async update(id: string, data: Partial<Omit<Note, "id" | "createdAt">>): Promise<Note> {
    const [result] = await this.db
      .update(notes)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

    if (!result) {
      throw new Error("Note not found");
    }

    return result as Note;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(notes).where(eq(notes.id, id));
  }

  async count(localOnly = false): Promise<number> {
    if (localOnly) {
      const [result] = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .innerJoin(users, eq(notes.userId, users.id))
        .where(and(isNull(users.host), eq(notes.isDeleted, false)));

      return result?.count ?? 0;
    }

    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes)
      .where(eq(notes.isDeleted, false));

    return result?.count ?? 0;
  }

  async countByUserId(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes)
      .where(and(eq(notes.userId, userId), eq(notes.isDeleted, false)));

    return result?.count ?? 0;
  }


  async incrementRepliesCount(noteId: string): Promise<void> {
    await this.db
      .update(notes)
      .set({ repliesCount: sql`${notes.repliesCount} + 1` })
      .where(eq(notes.id, noteId));
  }

  async decrementRepliesCount(noteId: string): Promise<void> {
    await this.db
      .update(notes)
      .set({ repliesCount: sql`GREATEST(${notes.repliesCount} - 1, 0)` })
      .where(eq(notes.id, noteId));
  }

  async incrementRenoteCount(noteId: string): Promise<void> {
    await this.db
      .update(notes)
      .set({ renoteCount: sql`${notes.renoteCount} + 1` })
      .where(eq(notes.id, noteId));
  }

  async decrementRenoteCount(noteId: string): Promise<void> {
    await this.db
      .update(notes)
      .set({ renoteCount: sql`GREATEST(${notes.renoteCount} - 1, 0)` })
      .where(eq(notes.id, noteId));
  }

  async softDelete(id: string, deletedById: string, reason?: string): Promise<Note | null> {
    const [result] = await this.db
      .update(notes)
      .set({
        isDeleted: true,
        deletedAt: new Date(),
        deletedById,
        deletionReason: reason ?? null,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

    return (result as Note) ?? null;
  }

  async restore(id: string): Promise<Note | null> {
    const [result] = await this.db
      .update(notes)
      .set({
        isDeleted: false,
        deletedAt: null,
        deletedById: null,
        deletionReason: null,
        updatedAt: new Date(),
      })
      .where(eq(notes.id, id))
      .returning();

    return (result as Note) ?? null;
  }

  async findDeletedNotes(options?: {
    limit?: number;
    offset?: number;
    deletedById?: string;
  }): Promise<Note[]> {
    const { limit = 100, offset = 0, deletedById } = options ?? {};

    const conditions = [eq(notes.isDeleted, true)];

    if (deletedById) {
      conditions.push(eq(notes.deletedById, deletedById));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.deletedAt))
      .limit(limit)
      .offset(offset);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
          },
        }) as Note,
    );
  }

  async findMentionsAndReplies(userId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [
      eq(notes.isDeleted, false),
      // Exclude own notes
      sql`${notes.userId} != ${userId}`,
      // Either mentioned in the note OR the note is a reply to user's note
      or(
        sql`${notes.mentions}::jsonb @> ${JSON.stringify([userId])}::jsonb`,
        sql`EXISTS (SELECT 1 FROM ${notes} AS parent WHERE parent.id = ${notes.replyId} AND parent.user_id = ${userId})`,
      ),
    ];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async findDirectMessages(userId: string, options: TimelineOptions): Promise<Note[]> {
    const { limit = 20, sinceId, untilId } = options;

    const conditions = [
      eq(notes.isDeleted, false),
      eq(notes.visibility, "specified"),
      // User is sender OR receiver (in mentions array)
      or(
        eq(notes.userId, userId),
        sql`${notes.mentions}::jsonb @> ${JSON.stringify([userId])}::jsonb`,
      ),
    ];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async findDirectMessageThread(
    userId: string,
    partnerId: string,
    options: TimelineOptions,
  ): Promise<Note[]> {
    const { limit = 50, sinceId, untilId } = options;

    const conditions = [
      eq(notes.isDeleted, false),
      eq(notes.visibility, "specified"),
      // Messages between user and partner (either direction)
      or(
        // User sent to partner
        and(
          eq(notes.userId, userId),
          sql`${notes.mentions}::jsonb @> ${JSON.stringify([partnerId])}::jsonb`,
        ),
        // Partner sent to user
        and(
          eq(notes.userId, partnerId),
          sql`${notes.mentions}::jsonb @> ${JSON.stringify([userId])}::jsonb`,
        ),
      ),
    ];

    if (sinceId) {
      conditions.push(gt(notes.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(notes.id, untilId));
    }

    const results = await this.db
      .select()
      .from(notes)
      .innerJoin(users, eq(notes.userId, users.id))
      .where(and(...conditions))
      .orderBy(desc(notes.createdAt))
      .limit(limit);

    return results.map(
      (r) =>
        ({
          ...r.notes,
          user: {
            id: r.users.id,
            username: r.users.username,
            name: r.users.displayName || r.users.username,
            displayName: r.users.displayName,
            avatarUrl: r.users.avatarUrl,
            host: r.users.host,
            profileEmojis: r.users.profileEmojis,
          },
        }) as Note,
    );
  }

  async getConversationPartners(
    userId: string,
    limit: number,
  ): Promise<
    Array<{
      partnerId: string;
      partnerUsername: string;
      partnerDisplayName: string | null;
      partnerAvatarUrl: string | null;
      partnerHost: string | null;
      partnerProfileEmojis: Array<{ name: string; url: string }> | null;
      lastNoteId: string;
      lastNoteText: string | null;
      lastNoteCreatedAt: Date;
    }>
  > {
    // Debug: First query to see raw DM data
    const debugResult = await this.db.execute(sql`
      SELECT
        n.id as note_id,
        n.text as note_text,
        n.user_id,
        n.mentions,
        n.visibility,
        jsonb_array_length(n.mentions::jsonb) as mentions_length,
        CASE WHEN n.user_id = ${userId} THEN 'sent' ELSE 'received' END as direction
      FROM notes n
      WHERE n.visibility = 'specified'
        AND n.is_deleted = false
        AND (
          n.user_id = ${userId}
          OR n.mentions::jsonb @> ${JSON.stringify([userId])}::jsonb
        )
      ORDER BY n.created_at DESC
      LIMIT 10
    `);

    logger.info(
      {
        userId,
        rawDMs: (debugResult.rows as any[]).map((r) => ({
          noteId: r.note_id,
          text: r.note_text?.substring(0, 20),
          senderId: r.user_id,
          mentions: r.mentions,
          mentionsLength: r.mentions_length,
          direction: r.direction,
        })),
      },
      "Raw DM data for debugging",
    );

    // Use raw SQL for this complex query with DISTINCT ON
    // For DMs:
    // - When I send: user_id = me, mentions contains recipient(s) -> partner is first mention
    // - When I receive: user_id = sender, mentions contains me -> partner is sender
    const result = await this.db.execute(sql`
      WITH dm_conversations AS (
        SELECT
          n.id as note_id,
          n.text as note_text,
          n.created_at,
          n.user_id,
          n.mentions,
          CASE
            WHEN n.user_id = ${userId} THEN
              -- I sent this DM: get first recipient from mentions (filter out myself if present)
              (SELECT elem::text FROM jsonb_array_elements_text(n.mentions::jsonb) AS elem WHERE elem::text != ${userId} LIMIT 1)
            ELSE
              -- I received this DM: sender is the partner
              n.user_id
          END as partner_id
        FROM notes n
        WHERE n.visibility = 'specified'
          AND n.is_deleted = false
          AND (
            -- I sent the DM (mentions must have at least one recipient that isn't me)
            (n.user_id = ${userId} AND jsonb_array_length(n.mentions::jsonb) > 0)
            -- OR I received the DM (I'm in the mentions)
            OR n.mentions::jsonb @> ${JSON.stringify([userId])}::jsonb
          )
      ),
      latest_per_partner AS (
        SELECT DISTINCT ON (partner_id)
          partner_id,
          note_id,
          note_text,
          created_at
        FROM dm_conversations
        WHERE partner_id IS NOT NULL AND partner_id != '' AND partner_id != ${userId}
        ORDER BY partner_id, created_at DESC
      )
      SELECT
        l.partner_id,
        u.username as partner_username,
        u.display_name as partner_display_name,
        u.avatar_url as partner_avatar_url,
        u.host as partner_host,
        u.profile_emojis as partner_profile_emojis,
        l.note_id as last_note_id,
        l.note_text as last_note_text,
        l.created_at as last_note_created_at
      FROM latest_per_partner l
      INNER JOIN users u ON u.id = l.partner_id
      ORDER BY l.created_at DESC
      LIMIT ${limit}
    `);

    return (result.rows as any[]).map((row) => ({
      partnerId: row.partner_id,
      partnerUsername: row.partner_username,
      partnerDisplayName: row.partner_display_name,
      partnerAvatarUrl: row.partner_avatar_url,
      partnerHost: row.partner_host,
      partnerProfileEmojis: row.partner_profile_emojis,
      lastNoteId: row.last_note_id,
      lastNoteText: row.last_note_text,
      lastNoteCreatedAt: new Date(row.last_note_created_at),
    }));
  }

  /**
   * Count notes created within a time period
   * Used for Mastodon API instance activity statistics
   */
  async countInPeriod(startDate: Date, endDate: Date, localOnly = true): Promise<number> {
    const conditions = [
      sql`${notes.createdAt} >= ${startDate}`,
      sql`${notes.createdAt} < ${endDate}`,
      isNull(notes.deletedAt),
    ];

    if (localOnly) {
      // Join with users to filter local notes
      const result = await this.db
        .select({ count: sql<number>`count(*)::int` })
        .from(notes)
        .innerJoin(users, eq(notes.userId, users.id))
        .where(and(...conditions, isNull(users.host)));

      return result[0]?.count ?? 0;
    }

    const result = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(notes)
      .where(and(...conditions));

    return result[0]?.count ?? 0;
  }
}
