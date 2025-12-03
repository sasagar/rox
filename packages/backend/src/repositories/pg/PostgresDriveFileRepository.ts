import { eq, and, inArray, desc, gt, lt, sql } from "drizzle-orm";
import type { Database } from "../../db/index.js";
import { driveFiles } from "../../db/schema/pg.js";
import type { IDriveFileRepository } from "../../interfaces/repositories/IDriveFileRepository.js";
import type { DriveFile } from "shared";

export class PostgresDriveFileRepository implements IDriveFileRepository {
  constructor(private db: Database) {}

  async create(file: Omit<DriveFile, "createdAt" | "updatedAt">): Promise<DriveFile> {
    const now = new Date();
    const [result] = await this.db
      .insert(driveFiles)
      .values({
        ...file,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    if (!result) {
      throw new Error("Failed to create file");
    }

    return result as DriveFile;
  }

  async findById(id: string): Promise<DriveFile | null> {
    const [result] = await this.db.select().from(driveFiles).where(eq(driveFiles.id, id)).limit(1);

    return (result as DriveFile) ?? null;
  }

  async findAll(options?: { limit?: number; offset?: number }): Promise<DriveFile[]> {
    const { limit = 1000, offset = 0 } = options ?? {};

    const results = await this.db
      .select()
      .from(driveFiles)
      .orderBy(desc(driveFiles.createdAt))
      .limit(limit)
      .offset(offset);

    return results as DriveFile[];
  }

  async findByMd5(md5: string, userId: string): Promise<DriveFile | null> {
    const [result] = await this.db
      .select()
      .from(driveFiles)
      .where(and(eq(driveFiles.md5, md5), eq(driveFiles.userId, userId)))
      .limit(1);

    return (result as DriveFile) ?? null;
  }

  async findByUserId(
    userId: string,
    options?: {
      limit?: number;
      sinceId?: string;
      untilId?: string;
      folderId?: string | null;
    },
  ): Promise<DriveFile[]> {
    const { limit = 20, sinceId, untilId, folderId } = options ?? {};

    let conditions = [eq(driveFiles.userId, userId)];

    if (sinceId) {
      conditions.push(gt(driveFiles.id, sinceId));
    }

    if (untilId) {
      conditions.push(lt(driveFiles.id, untilId));
    }

    // Filter by folder - undefined means no filter, null means root folder (no parent)
    if (folderId !== undefined) {
      if (folderId === null) {
        conditions.push(sql`${driveFiles.folderId} IS NULL`);
      } else {
        conditions.push(eq(driveFiles.folderId, folderId));
      }
    }

    const results = await this.db
      .select()
      .from(driveFiles)
      .where(and(...conditions))
      .orderBy(desc(driveFiles.createdAt))
      .limit(limit);

    return results as DriveFile[];
  }

  async moveToFolder(id: string, folderId: string | null): Promise<DriveFile> {
    const [result] = await this.db
      .update(driveFiles)
      .set({
        folderId,
        updatedAt: new Date(),
      })
      .where(eq(driveFiles.id, id))
      .returning();

    if (!result) {
      throw new Error("File not found");
    }

    return result as DriveFile;
  }

  async findByIds(ids: string[]): Promise<DriveFile[]> {
    if (ids.length === 0) {
      return [];
    }

    const results = await this.db.select().from(driveFiles).where(inArray(driveFiles.id, ids));

    return results as DriveFile[];
  }

  async update(
    id: string,
    data: Partial<Omit<DriveFile, "id" | "userId" | "createdAt">>,
  ): Promise<DriveFile> {
    const [result] = await this.db
      .update(driveFiles)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(driveFiles.id, id))
      .returning();

    if (!result) {
      throw new Error("File not found");
    }

    return result as DriveFile;
  }

  async delete(id: string): Promise<void> {
    await this.db.delete(driveFiles).where(eq(driveFiles.id, id));
  }

  async getTotalSize(userId: string): Promise<number> {
    const [result] = await this.db
      .select({ total: sql<number>`sum(${driveFiles.size})::bigint` })
      .from(driveFiles)
      .where(eq(driveFiles.userId, userId));

    return Number(result?.total ?? 0);
  }
}
