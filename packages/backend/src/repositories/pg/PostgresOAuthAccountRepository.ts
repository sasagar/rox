import { eq, and, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { oauthAccounts, type OAuthAccount, type NewOAuthAccount } from "../../db/schema/pg.js";
import type {
  IOAuthAccountRepository,
  OAuthProvider,
} from "../../interfaces/repositories/IOAuthAccountRepository.js";

/**
 * PostgreSQL implementation of OAuth Account Repository
 */
export class PostgresOAuthAccountRepository implements IOAuthAccountRepository {
  constructor(private db: Database) {}

  async create(account: NewOAuthAccount): Promise<OAuthAccount> {
    const [result] = await this.db.insert(oauthAccounts).values(account).returning();

    if (!result) {
      throw new Error("Failed to create OAuth account");
    }

    return result;
  }

  async findById(id: string): Promise<OAuthAccount | null> {
    const [result] = await this.db
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.id, id))
      .limit(1);

    return result ?? null;
  }

  async findByProviderAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<OAuthAccount | null> {
    const [result] = await this.db
      .select()
      .from(oauthAccounts)
      .where(
        and(eq(oauthAccounts.provider, provider), eq(oauthAccounts.providerAccountId, providerAccountId)),
      )
      .limit(1);

    return result ?? null;
  }

  async findByUserAndProvider(userId: string, provider: OAuthProvider): Promise<OAuthAccount | null> {
    const [result] = await this.db
      .select()
      .from(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)))
      .limit(1);

    return result ?? null;
  }

  async findByUserId(userId: string): Promise<OAuthAccount[]> {
    const results = await this.db
      .select()
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId))
      .orderBy(oauthAccounts.createdAt);

    return results;
  }

  async updateTokens(
    id: string,
    data: {
      accessToken?: string | null;
      refreshToken?: string | null;
      tokenExpiresAt?: Date | null;
      scope?: string | null;
    },
  ): Promise<OAuthAccount> {
    const [result] = await this.db
      .update(oauthAccounts)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(oauthAccounts.id, id))
      .returning();

    if (!result) {
      throw new Error("OAuth account not found");
    }

    return result;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(oauthAccounts).where(eq(oauthAccounts.id, id));
  }

  async deleteByUserAndProvider(userId: string, provider: OAuthProvider): Promise<void> {
    await this.db
      .delete(oauthAccounts)
      .where(and(eq(oauthAccounts.userId, userId), eq(oauthAccounts.provider, provider)));
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.db.delete(oauthAccounts).where(eq(oauthAccounts.userId, userId));
  }

  async countByUserId(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(oauthAccounts)
      .where(eq(oauthAccounts.userId, userId));

    return result?.count ?? 0;
  }
}
