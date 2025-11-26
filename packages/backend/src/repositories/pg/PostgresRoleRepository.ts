/**
 * PostgreSQL Role Repository
 *
 * Implements IRoleRepository for PostgreSQL database.
 *
 * @module repositories/pg/PostgresRoleRepository
 */

import { eq, asc, sql, desc } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { roles, type Role } from '../../db/schema/pg.js';
import type {
  IRoleRepository,
  CreateRoleInput,
  UpdateRoleInput,
} from '../../interfaces/repositories/IRoleRepository.js';
import { generateId } from 'shared';

/**
 * PostgreSQL implementation of Role Repository
 */
export class PostgresRoleRepository implements IRoleRepository {
  constructor(private db: Database) {}

  async create(data: CreateRoleInput): Promise<Role> {
    const [result] = await this.db
      .insert(roles)
      .values({
        id: generateId(),
        name: data.name,
        description: data.description ?? null,
        color: data.color ?? null,
        iconUrl: data.iconUrl ?? null,
        displayOrder: data.displayOrder ?? 0,
        isPublic: data.isPublic ?? false,
        isDefault: data.isDefault ?? false,
        isAdminRole: data.isAdminRole ?? false,
        isModeratorRole: data.isModeratorRole ?? false,
        policies: data.policies ?? {},
      })
      .returning();

    if (!result) {
      throw new Error('Failed to create role');
    }

    return result;
  }

  async findById(id: string): Promise<Role | null> {
    const [result] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.id, id))
      .limit(1);

    return result ?? null;
  }

  async findByName(name: string): Promise<Role | null> {
    const [result] = await this.db
      .select()
      .from(roles)
      .where(eq(roles.name, name))
      .limit(1);

    return result ?? null;
  }

  async findAll(limit = 100, offset = 0): Promise<Role[]> {
    return this.db
      .select()
      .from(roles)
      .orderBy(asc(roles.displayOrder), desc(roles.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async findDefaultRoles(): Promise<Role[]> {
    return this.db
      .select()
      .from(roles)
      .where(eq(roles.isDefault, true))
      .orderBy(asc(roles.displayOrder));
  }

  async findAdminRoles(): Promise<Role[]> {
    return this.db
      .select()
      .from(roles)
      .where(eq(roles.isAdminRole, true))
      .orderBy(asc(roles.displayOrder));
  }

  async findModeratorRoles(): Promise<Role[]> {
    return this.db
      .select()
      .from(roles)
      .where(eq(roles.isModeratorRole, true))
      .orderBy(asc(roles.displayOrder));
  }

  async update(id: string, data: UpdateRoleInput): Promise<Role | null> {
    const updateData: Partial<typeof roles.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.color !== undefined) updateData.color = data.color;
    if (data.iconUrl !== undefined) updateData.iconUrl = data.iconUrl;
    if (data.displayOrder !== undefined) updateData.displayOrder = data.displayOrder;
    if (data.isPublic !== undefined) updateData.isPublic = data.isPublic;
    if (data.isDefault !== undefined) updateData.isDefault = data.isDefault;
    if (data.isAdminRole !== undefined) updateData.isAdminRole = data.isAdminRole;
    if (data.isModeratorRole !== undefined) updateData.isModeratorRole = data.isModeratorRole;
    if (data.policies !== undefined) updateData.policies = data.policies;

    const [result] = await this.db
      .update(roles)
      .set(updateData)
      .where(eq(roles.id, id))
      .returning();

    return result ?? null;
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.db
      .delete(roles)
      .where(eq(roles.id, id))
      .returning({ id: roles.id });

    return result.length > 0;
  }

  async count(): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(roles);

    return result?.count ?? 0;
  }
}
