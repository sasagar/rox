/**
 * Role Assignment Repository Interface
 *
 * Provides methods for managing user-role relationships.
 *
 * @module interfaces/repositories/IRoleAssignmentRepository
 */

import type { Role, RoleAssignment } from "../../db/schema/pg.js";

/**
 * Role assignment with role details
 */
export interface RoleAssignmentWithRole extends RoleAssignment {
  role: Role;
}

/**
 * Role assignment repository interface
 */
export interface IRoleAssignmentRepository {
  /**
   * Assigns a role to a user
   * @param userId - User ID
   * @param roleId - Role ID
   * @param assignedById - ID of user who assigned the role (optional)
   * @param expiresAt - When the assignment expires (optional)
   * @returns Created assignment
   */
  assign(
    userId: string,
    roleId: string,
    assignedById?: string,
    expiresAt?: Date,
  ): Promise<RoleAssignment>;

  /**
   * Removes a role from a user
   * @param userId - User ID
   * @param roleId - Role ID
   * @returns True if unassigned, false if assignment not found
   */
  unassign(userId: string, roleId: string): Promise<boolean>;

  /**
   * Finds all role assignments for a user
   * @param userId - User ID
   * @returns Array of role assignments with role details
   */
  findByUserId(userId: string): Promise<RoleAssignmentWithRole[]>;

  /**
   * Finds all role assignments for a user (roles only)
   * @param userId - User ID
   * @returns Array of roles assigned to the user
   */
  findRolesByUserId(userId: string): Promise<Role[]>;

  /**
   * Finds all user IDs with a specific role
   * @param roleId - Role ID
   * @param limit - Maximum number of users to return
   * @param offset - Number of users to skip
   * @returns Array of user IDs
   */
  findUserIdsByRoleId(roleId: string, limit?: number, offset?: number): Promise<string[]>;

  /**
   * Counts users with a specific role
   * @param roleId - Role ID
   * @returns Count of users
   */
  countUsersByRoleId(roleId: string): Promise<number>;

  /**
   * Checks if a user has a specific role
   * @param userId - User ID
   * @param roleId - Role ID
   * @returns True if user has the role
   */
  hasRole(userId: string, roleId: string): Promise<boolean>;

  /**
   * Checks if a user has any admin role
   * @param userId - User ID
   * @returns True if user has an admin role
   */
  hasAdminRole(userId: string): Promise<boolean>;

  /**
   * Checks if a user has any moderator role
   * @param userId - User ID
   * @returns True if user has a moderator role
   */
  hasModeratorRole(userId: string): Promise<boolean>;

  /**
   * Removes all role assignments for a user
   * @param userId - User ID
   * @returns Number of assignments removed
   */
  removeAllForUser(userId: string): Promise<number>;

  /**
   * Removes expired role assignments
   * @returns Number of assignments removed
   */
  removeExpired(): Promise<number>;
}
