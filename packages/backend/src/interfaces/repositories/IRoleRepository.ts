/**
 * Role Repository Interface
 *
 * Provides methods for role CRUD operations and queries.
 *
 * @module interfaces/repositories/IRoleRepository
 */

import type { Role, RolePolicies } from "../../db/schema/pg.js";

/**
 * Input for creating a new role
 */
export interface CreateRoleInput {
  name: string;
  description?: string;
  color?: string;
  iconUrl?: string;
  displayOrder?: number;
  isPublic?: boolean;
  isDefault?: boolean;
  isAdminRole?: boolean;
  isModeratorRole?: boolean;
  policies?: RolePolicies;
}

/**
 * Input for updating a role
 */
export interface UpdateRoleInput {
  name?: string;
  description?: string;
  color?: string;
  iconUrl?: string;
  displayOrder?: number;
  isPublic?: boolean;
  isDefault?: boolean;
  isAdminRole?: boolean;
  isModeratorRole?: boolean;
  policies?: RolePolicies;
}

/**
 * Role repository interface
 */
export interface IRoleRepository {
  /**
   * Creates a new role
   * @param data - Role creation data
   * @returns Created role
   */
  create(data: CreateRoleInput): Promise<Role>;

  /**
   * Finds a role by its ID
   * @param id - Role ID
   * @returns Role or null if not found
   */
  findById(id: string): Promise<Role | null>;

  /**
   * Finds a role by its name
   * @param name - Role name
   * @returns Role or null if not found
   */
  findByName(name: string): Promise<Role | null>;

  /**
   * Finds all roles
   * @param limit - Maximum number of roles to return
   * @param offset - Number of roles to skip
   * @returns Array of roles ordered by displayOrder
   */
  findAll(limit?: number, offset?: number): Promise<Role[]>;

  /**
   * Finds all default roles (auto-assigned to new users)
   * @returns Array of default roles
   */
  findDefaultRoles(): Promise<Role[]>;

  /**
   * Finds all admin roles
   * @returns Array of admin roles
   */
  findAdminRoles(): Promise<Role[]>;

  /**
   * Finds all moderator roles
   * @returns Array of moderator roles
   */
  findModeratorRoles(): Promise<Role[]>;

  /**
   * Updates a role
   * @param id - Role ID
   * @param data - Update data
   * @returns Updated role or null if not found
   */
  update(id: string, data: UpdateRoleInput): Promise<Role | null>;

  /**
   * Deletes a role
   * @param id - Role ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Counts total roles
   * @returns Total count
   */
  count(): Promise<number>;
}
