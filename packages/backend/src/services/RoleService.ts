/**
 * RoleService
 *
 * Service for role management and permission checking.
 * Computes effective policies by merging all assigned role policies.
 * Supports Redis caching for improved performance.
 */

import type { IRoleRepository } from "../interfaces/repositories/IRoleRepository.js";
import type { IRoleAssignmentRepository } from "../interfaces/repositories/IRoleAssignmentRepository.js";
import type { RolePolicies, Role } from "../db/schema/pg.js";
import type { ICacheService } from "../interfaces/ICacheService.js";
import { CacheTTL, CachePrefix } from "../adapters/cache/DragonflyCacheAdapter.js";

/**
 * Default policies applied to all users (base permissions)
 */
const DEFAULT_POLICIES: RolePolicies = {
  canViewGlobalTimeline: true,
  canViewLocalTimeline: true,
  canPublicNote: true,
  canCreateNote: true,
  canInvite: false,
  inviteLimit: 0,
  inviteLimitCycle: 24,
  rateLimitFactor: 1.0,
  driveCapacityMb: 100,
  maxFileSizeMb: 10,
  canManageStorageQuotas: false,
  canViewSystemAcquiredFiles: false,
  maxScheduledNotes: 10,
  canManageReports: false,
  canDeleteNotes: false,
  canSuspendUsers: false,
  canManageContacts: false,
  canManageRoles: false,
  canManageInstanceSettings: false,
  canManageInstanceBlocks: false,
  canManageUsers: false,
};

/**
 * Merge multiple policies with "most permissive" strategy for boolean values
 * and "highest value" strategy for numeric values.
 */
function mergePolicies(...policies: RolePolicies[]): RolePolicies {
  const merged: RolePolicies = { ...DEFAULT_POLICIES };

  for (const policy of policies) {
    // Boolean permissions: true if any role grants it
    if (policy.canViewGlobalTimeline) merged.canViewGlobalTimeline = true;
    if (policy.canViewLocalTimeline) merged.canViewLocalTimeline = true;
    if (policy.canPublicNote) merged.canPublicNote = true;
    if (policy.canCreateNote) merged.canCreateNote = true;
    if (policy.canInvite) merged.canInvite = true;
    if (policy.canManageReports) merged.canManageReports = true;
    if (policy.canDeleteNotes) merged.canDeleteNotes = true;
    if (policy.canSuspendUsers) merged.canSuspendUsers = true;
    if (policy.canManageContacts) merged.canManageContacts = true;
    if (policy.canManageRoles) merged.canManageRoles = true;
    if (policy.canManageInstanceSettings) merged.canManageInstanceSettings = true;
    if (policy.canManageInstanceBlocks) merged.canManageInstanceBlocks = true;
    if (policy.canManageUsers) merged.canManageUsers = true;
    if (policy.canManageStorageQuotas) merged.canManageStorageQuotas = true;
    if (policy.canViewSystemAcquiredFiles) merged.canViewSystemAcquiredFiles = true;

    // Numeric values: take the highest (most permissive)
    if (
      policy.inviteLimit !== undefined &&
      (merged.inviteLimit === undefined ||
        policy.inviteLimit === -1 ||
        (merged.inviteLimit !== -1 && policy.inviteLimit > merged.inviteLimit))
    ) {
      merged.inviteLimit = policy.inviteLimit;
    }

    if (
      policy.inviteLimitCycle !== undefined &&
      (merged.inviteLimitCycle === undefined || policy.inviteLimitCycle > merged.inviteLimitCycle)
    ) {
      merged.inviteLimitCycle = policy.inviteLimitCycle;
    }

    // Rate limit factor: take the lowest (more permissive = less restricted)
    if (
      policy.rateLimitFactor !== undefined &&
      (merged.rateLimitFactor === undefined || policy.rateLimitFactor < merged.rateLimitFactor)
    ) {
      merged.rateLimitFactor = policy.rateLimitFactor;
    }

    // Drive capacity: take the highest
    if (
      policy.driveCapacityMb !== undefined &&
      (merged.driveCapacityMb === undefined || policy.driveCapacityMb > merged.driveCapacityMb)
    ) {
      merged.driveCapacityMb = policy.driveCapacityMb;
    }

    // Max file size: take the highest
    if (
      policy.maxFileSizeMb !== undefined &&
      (merged.maxFileSizeMb === undefined || policy.maxFileSizeMb > merged.maxFileSizeMb)
    ) {
      merged.maxFileSizeMb = policy.maxFileSizeMb;
    }

    // Max scheduled notes: take the highest (-1 = unlimited)
    if (
      policy.maxScheduledNotes !== undefined &&
      (merged.maxScheduledNotes === undefined ||
        policy.maxScheduledNotes === -1 ||
        (merged.maxScheduledNotes !== -1 && policy.maxScheduledNotes > merged.maxScheduledNotes))
    ) {
      merged.maxScheduledNotes = policy.maxScheduledNotes;
    }
  }

  return merged;
}

export class RoleService {
  private readonly roleRepository: IRoleRepository;
  private readonly roleAssignmentRepository: IRoleAssignmentRepository;
  private readonly cacheService: ICacheService | null;

  constructor(
    roleRepository: IRoleRepository,
    roleAssignmentRepository: IRoleAssignmentRepository,
    cacheService?: ICacheService,
  ) {
    this.roleRepository = roleRepository;
    this.roleAssignmentRepository = roleAssignmentRepository;
    this.cacheService = cacheService ?? null;
  }

  /**
   * Get cache key for user policies
   */
  private getPoliciesCacheKey(userId: string): string {
    return `${CachePrefix.ROLE_POLICIES}:${userId}`;
  }

  /**
   * Invalidate cached policies for a user
   */
  private async invalidateUserPolicies(userId: string): Promise<void> {
    if (this.cacheService?.isAvailable()) {
      await this.cacheService.delete(this.getPoliciesCacheKey(userId));
    }
  }

  /**
   * Get all roles assigned to a user
   */
  async getUserRoles(userId: string): Promise<Role[]> {
    return this.roleAssignmentRepository.findRolesByUserId(userId);
  }

  /**
   * Get effective policies for a user by merging all assigned role policies
   */
  async getEffectivePolicies(userId: string): Promise<RolePolicies> {
    const cacheKey = this.getPoliciesCacheKey(userId);

    // Try cache first
    if (this.cacheService?.isAvailable()) {
      const cached = await this.cacheService.get<RolePolicies>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const roles = await this.getUserRoles(userId);
    let result: RolePolicies;

    if (roles.length === 0) {
      // User has no roles, check for default roles
      const defaultRoles = await this.roleRepository.findDefaultRoles();
      if (defaultRoles.length > 0) {
        result = mergePolicies(...defaultRoles.map((r) => r.policies));
      } else {
        result = { ...DEFAULT_POLICIES };
      }
    } else {
      result = mergePolicies(...roles.map((r) => r.policies));
    }

    // Cache the result (5 minutes - policies can change but not frequently)
    if (this.cacheService?.isAvailable()) {
      await this.cacheService.set(cacheKey, result, { ttl: CacheTTL.MEDIUM });
    }

    return result;
  }

  /**
   * Check if user has a specific permission
   */
  async hasPermission(userId: string, permission: keyof RolePolicies): Promise<boolean> {
    const policies = await this.getEffectivePolicies(userId);
    const value = policies[permission];
    return typeof value === "boolean" ? value : false;
  }

  /**
   * Check if user is an admin (has admin role or all admin permissions)
   */
  async isAdmin(userId: string): Promise<boolean> {
    // First check if user has an admin role
    const hasAdminRole = await this.roleAssignmentRepository.hasAdminRole(userId);
    if (hasAdminRole) return true;

    // Otherwise check if user has all admin permissions
    const policies = await this.getEffectivePolicies(userId);
    return !!(
      policies.canManageRoles &&
      policies.canManageInstanceSettings &&
      policies.canManageInstanceBlocks &&
      policies.canManageUsers
    );
  }

  /**
   * Check if user is a moderator (has moderator role or moderation permissions)
   */
  async isModerator(userId: string): Promise<boolean> {
    // First check if user has a moderator role
    const hasModRole = await this.roleAssignmentRepository.hasModeratorRole(userId);
    if (hasModRole) return true;

    // Otherwise check if user has moderation permissions
    const policies = await this.getEffectivePolicies(userId);
    return !!(policies.canManageReports || policies.canDeleteNotes || policies.canSuspendUsers);
  }

  /**
   * Check if user can invite others
   */
  async canInvite(userId: string): Promise<boolean> {
    const policies = await this.getEffectivePolicies(userId);
    return !!policies.canInvite;
  }

  /**
   * Check if user can manage contact inquiries
   */
  async canManageContacts(userId: string): Promise<boolean> {
    const policies = await this.getEffectivePolicies(userId);
    return !!policies.canManageContacts;
  }

  /**
   * Get user's invite limit (-1 = unlimited, 0 = cannot invite)
   */
  async getInviteLimit(userId: string): Promise<number> {
    const policies = await this.getEffectivePolicies(userId);
    if (!policies.canInvite) return 0;
    return policies.inviteLimit ?? 0;
  }

  /**
   * Get user's rate limit factor (lower = less restricted)
   */
  async getRateLimitFactor(userId: string): Promise<number> {
    const policies = await this.getEffectivePolicies(userId);
    return policies.rateLimitFactor ?? 1.0;
  }

  /**
   * Get user's drive capacity in MB
   */
  async getDriveCapacity(userId: string): Promise<number> {
    const policies = await this.getEffectivePolicies(userId);
    return policies.driveCapacityMb ?? 100;
  }

  /**
   * Get user's max file size in MB
   */
  async getMaxFileSize(userId: string): Promise<number> {
    const policies = await this.getEffectivePolicies(userId);
    return policies.maxFileSizeMb ?? 10;
  }

  /**
   * Assign a role to a user
   */
  async assignRole(
    userId: string,
    roleId: string,
    assignedById?: string,
    expiresAt?: Date,
  ): Promise<void> {
    await this.roleAssignmentRepository.assign(userId, roleId, assignedById, expiresAt);
    // Invalidate cached policies for the user
    await this.invalidateUserPolicies(userId);
  }

  /**
   * Remove a role from a user
   */
  async unassignRole(userId: string, roleId: string): Promise<boolean> {
    const result = await this.roleAssignmentRepository.unassign(userId, roleId);
    // Invalidate cached policies for the user
    await this.invalidateUserPolicies(userId);
    return result;
  }

  /**
   * Create default admin role if it doesn't exist
   */
  async ensureAdminRole(): Promise<Role> {
    const existingAdmin = await this.roleRepository.findByName("Admin");
    if (existingAdmin) return existingAdmin;

    return this.roleRepository.create({
      name: "Admin",
      description: "Administrator with full permissions",
      color: "#ff0000",
      isPublic: false,
      isDefault: false,
      isAdminRole: true,
      isModeratorRole: false,
      displayOrder: 0,
      policies: {
        canViewGlobalTimeline: true,
        canViewLocalTimeline: true,
        canPublicNote: true,
        canCreateNote: true,
        canInvite: true,
        inviteLimit: -1,
        rateLimitFactor: 0.1,
        driveCapacityMb: 10000,
        maxFileSizeMb: 100,
        canManageReports: true,
        canDeleteNotes: true,
        canSuspendUsers: true,
        canManageContacts: true,
        canManageRoles: true,
        canManageInstanceSettings: true,
        canManageInstanceBlocks: true,
        canManageUsers: true,
      },
    });
  }

  /**
   * Create default moderator role if it doesn't exist
   */
  async ensureModeratorRole(): Promise<Role> {
    const existingMod = await this.roleRepository.findByName("Moderator");
    if (existingMod) return existingMod;

    return this.roleRepository.create({
      name: "Moderator",
      description: "Moderator with content management permissions",
      color: "#00ff00",
      isPublic: false,
      isDefault: false,
      isAdminRole: false,
      isModeratorRole: true,
      displayOrder: 1,
      policies: {
        canViewGlobalTimeline: true,
        canViewLocalTimeline: true,
        canPublicNote: true,
        canCreateNote: true,
        canInvite: true,
        inviteLimit: 10,
        rateLimitFactor: 0.5,
        driveCapacityMb: 1000,
        maxFileSizeMb: 50,
        canManageReports: true,
        canDeleteNotes: true,
        canSuspendUsers: true,
        canManageContacts: true,
        canManageRoles: false,
        canManageInstanceSettings: false,
        canManageInstanceBlocks: false,
        canManageUsers: false,
      },
    });
  }


  /**
   * Get user's max scheduled notes limit (-1 = unlimited, 0 = disabled)
   */
  async getMaxScheduledNotes(userId: string): Promise<number> {
    const policies = await this.getEffectivePolicies(userId);
    return policies.maxScheduledNotes ?? 10;
  }

  /**
   * Check if user can manage storage quotas
   */
  async canManageStorageQuotas(userId: string): Promise<boolean> {
    const policies = await this.getEffectivePolicies(userId);
    return !!policies.canManageStorageQuotas;
  }

  /**
   * Check if user can view system-acquired files
   */
  async canViewSystemAcquiredFiles(userId: string): Promise<boolean> {
    const policies = await this.getEffectivePolicies(userId);
    return !!policies.canViewSystemAcquiredFiles;
  }
}
