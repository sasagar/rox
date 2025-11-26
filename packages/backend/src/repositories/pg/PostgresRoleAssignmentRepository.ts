/**
 * PostgreSQL Role Assignment Repository
 *
 * Implements IRoleAssignmentRepository for PostgreSQL database.
 *
 * @module repositories/pg/PostgresRoleAssignmentRepository
 */

import { eq, and, sql, lt } from 'drizzle-orm';
import type { Database } from '../../db/index.js';
import { roleAssignments, roles, type Role, type RoleAssignment } from '../../db/schema/pg.js';
import type {
  IRoleAssignmentRepository,
  RoleAssignmentWithRole,
} from '../../interfaces/repositories/IRoleAssignmentRepository.js';
import { generateId } from 'shared';

/**
 * PostgreSQL implementation of Role Assignment Repository
 */
export class PostgresRoleAssignmentRepository implements IRoleAssignmentRepository {
  constructor(private db: Database) {}

  async assign(
    userId: string,
    roleId: string,
    assignedById?: string,
    expiresAt?: Date
  ): Promise<RoleAssignment> {
    const [result] = await this.db
      .insert(roleAssignments)
      .values({
        id: generateId(),
        userId,
        roleId,
        assignedById: assignedById ?? null,
        expiresAt: expiresAt ?? null,
      })
      .onConflictDoNothing()
      .returning();

    if (!result) {
      // Assignment already exists, fetch it
      const [existing] = await this.db
        .select()
        .from(roleAssignments)
        .where(
          and(
            eq(roleAssignments.userId, userId),
            eq(roleAssignments.roleId, roleId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new Error('Failed to assign role');
      }
      return existing;
    }

    return result;
  }

  async unassign(userId: string, roleId: string): Promise<boolean> {
    const result = await this.db
      .delete(roleAssignments)
      .where(
        and(
          eq(roleAssignments.userId, userId),
          eq(roleAssignments.roleId, roleId)
        )
      )
      .returning({ id: roleAssignments.id });

    return result.length > 0;
  }

  async findByUserId(userId: string): Promise<RoleAssignmentWithRole[]> {
    const results = await this.db
      .select({
        assignment: roleAssignments,
        role: roles,
      })
      .from(roleAssignments)
      .innerJoin(roles, eq(roleAssignments.roleId, roles.id))
      .where(eq(roleAssignments.userId, userId));

    return results.map((r) => ({
      ...r.assignment,
      role: r.role,
    }));
  }

  async findRolesByUserId(userId: string): Promise<Role[]> {
    const results = await this.db
      .select({ role: roles })
      .from(roleAssignments)
      .innerJoin(roles, eq(roleAssignments.roleId, roles.id))
      .where(eq(roleAssignments.userId, userId));

    return results.map((r) => r.role);
  }

  async findUserIdsByRoleId(roleId: string, limit = 100, offset = 0): Promise<string[]> {
    const results = await this.db
      .select({ userId: roleAssignments.userId })
      .from(roleAssignments)
      .where(eq(roleAssignments.roleId, roleId))
      .limit(limit)
      .offset(offset);

    return results.map((r) => r.userId);
  }

  async countUsersByRoleId(roleId: string): Promise<number> {
    const [result] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(roleAssignments)
      .where(eq(roleAssignments.roleId, roleId));

    return result?.count ?? 0;
  }

  async hasRole(userId: string, roleId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: roleAssignments.id })
      .from(roleAssignments)
      .where(
        and(
          eq(roleAssignments.userId, userId),
          eq(roleAssignments.roleId, roleId)
        )
      )
      .limit(1);

    return result !== undefined;
  }

  async hasAdminRole(userId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: roleAssignments.id })
      .from(roleAssignments)
      .innerJoin(roles, eq(roleAssignments.roleId, roles.id))
      .where(
        and(
          eq(roleAssignments.userId, userId),
          eq(roles.isAdminRole, true)
        )
      )
      .limit(1);

    return result !== undefined;
  }

  async hasModeratorRole(userId: string): Promise<boolean> {
    const [result] = await this.db
      .select({ id: roleAssignments.id })
      .from(roleAssignments)
      .innerJoin(roles, eq(roleAssignments.roleId, roles.id))
      .where(
        and(
          eq(roleAssignments.userId, userId),
          eq(roles.isModeratorRole, true)
        )
      )
      .limit(1);

    return result !== undefined;
  }

  async removeAllForUser(userId: string): Promise<number> {
    const result = await this.db
      .delete(roleAssignments)
      .where(eq(roleAssignments.userId, userId))
      .returning({ id: roleAssignments.id });

    return result.length;
  }

  async removeExpired(): Promise<number> {
    const now = new Date();
    const result = await this.db
      .delete(roleAssignments)
      .where(lt(roleAssignments.expiresAt, now))
      .returning({ id: roleAssignments.id });

    return result.length;
  }
}
