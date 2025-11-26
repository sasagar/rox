import { eq, sql, desc, and, gt, or, isNull, lt } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { invitationCodes, type InvitationCode } from '../../db/schema/pg.js';
import type { IInvitationCodeRepository } from '../../interfaces/repositories/IInvitationCodeRepository.js';
import { generateId } from 'shared';

/**
 * PostgreSQL implementation of Invitation Code Repository
 */
export class PostgresInvitationCodeRepository implements IInvitationCodeRepository {
  constructor(private db: Database) {}

  async create(data: {
    code: string;
    createdById: string;
    expiresAt?: Date;
    maxUses?: number;
  }): Promise<InvitationCode> {
    const [result] = await this.db
      .insert(invitationCodes)
      .values({
        id: generateId(),
        code: data.code,
        createdById: data.createdById,
        expiresAt: data.expiresAt ?? null,
        maxUses: data.maxUses ?? 1,
        useCount: 0,
      })
      .returning();

    if (!result) {
      throw new Error('Failed to create invitation code');
    }

    return result;
  }

  async findByCode(code: string): Promise<InvitationCode | null> {
    const [result] = await this.db
      .select()
      .from(invitationCodes)
      .where(eq(invitationCodes.code, code))
      .limit(1);

    return result ?? null;
  }

  async findById(id: string): Promise<InvitationCode | null> {
    const [result] = await this.db
      .select()
      .from(invitationCodes)
      .where(eq(invitationCodes.id, id))
      .limit(1);

    return result ?? null;
  }

  async findByCreatedBy(userId: string, limit = 100, offset = 0): Promise<InvitationCode[]> {
    return this.db
      .select()
      .from(invitationCodes)
      .where(eq(invitationCodes.createdById, userId))
      .orderBy(desc(invitationCodes.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findAll(limit = 100, offset = 0): Promise<InvitationCode[]> {
    return this.db
      .select()
      .from(invitationCodes)
      .orderBy(desc(invitationCodes.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async isValid(code: string): Promise<boolean> {
    const invitation = await this.findByCode(code);
    if (!invitation) return false;

    // Check if expired
    if (invitation.expiresAt && invitation.expiresAt < new Date()) {
      return false;
    }

    // Check if max uses reached
    if (invitation.maxUses !== null && invitation.useCount >= invitation.maxUses) {
      return false;
    }

    return true;
  }

  async use(code: string, usedById: string): Promise<InvitationCode | null> {
    const invitation = await this.findByCode(code);
    if (!invitation) return null;

    // Validate
    if (!await this.isValid(code)) {
      return null;
    }

    // Update use count and usedById
    const [updated] = await this.db
      .update(invitationCodes)
      .set({
        useCount: invitation.useCount + 1,
        usedById: invitation.maxUses === 1 ? usedById : invitation.usedById,
        usedAt: invitation.maxUses === 1 ? new Date() : invitation.usedAt,
      })
      .where(eq(invitationCodes.code, code))
      .returning();

    return updated ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(invitationCodes)
      .where(eq(invitationCodes.id, id))
      .returning({ id: invitationCodes.id });

    return result.length > 0;
  }

  async count(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(invitationCodes);

    return result?.count ?? 0;
  }

  async countUnused(): Promise<number> {
    const now = new Date();
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(invitationCodes)
      .where(
        and(
          // Not expired (expiresAt is null or > now)
          or(
            isNull(invitationCodes.expiresAt),
            gt(invitationCodes.expiresAt, now)
          ),
          // Not fully used (useCount < maxUses or maxUses is null)
          or(
            isNull(invitationCodes.maxUses),
            lt(invitationCodes.useCount, invitationCodes.maxUses)
          )
        )
      );

    return result?.count ?? 0;
  }

  async countRecentByCreator(userId: string, withinHours: number): Promise<number> {
    const cutoff = new Date(Date.now() - withinHours * 60 * 60 * 1000);
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(invitationCodes)
      .where(
        and(
          eq(invitationCodes.createdById, userId),
          gt(invitationCodes.createdAt, cutoff)
        )
      );

    return result?.count ?? 0;
  }
}
