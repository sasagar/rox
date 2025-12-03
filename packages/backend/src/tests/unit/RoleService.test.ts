/**
 * RoleService Unit Tests
 *
 * Tests role-based permission system including policy merging,
 * permission checks, and role management
 */

import { describe, test, expect, mock, beforeEach } from "bun:test";
import { RoleService } from "../../services/RoleService.js";
import type { IRoleRepository } from "../../interfaces/repositories/IRoleRepository.js";
import type { IRoleAssignmentRepository } from "../../interfaces/repositories/IRoleAssignmentRepository.js";
import type { Role } from "../../db/schema/pg.js";

/**
 * Partial mock types for testing
 */
type MockRoleRepo = Pick<
  IRoleRepository,
  "findById" | "findByName" | "findDefaultRoles" | "findAll" | "create"
>;
type MockRoleAssignmentRepo = Pick<
  IRoleAssignmentRepository,
  "findRolesByUserId" | "hasAdminRole" | "hasModeratorRole" | "assign" | "unassign"
>;

describe("RoleService", () => {
  // Mock data
  const mockAdminRole: Role = {
    id: "role-admin",
    name: "Admin",
    description: "Administrator with full permissions",
    color: "#ff0000",
    iconUrl: null,
    displayOrder: 0,
    isPublic: false,
    isDefault: false,
    isAdminRole: true,
    isModeratorRole: false,
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
      canManageRoles: true,
      canManageInstanceSettings: true,
      canManageInstanceBlocks: true,
      canManageUsers: true,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockModeratorRole: Role = {
    id: "role-moderator",
    name: "Moderator",
    description: "Moderator with content management",
    color: "#00ff00",
    iconUrl: null,
    displayOrder: 1,
    isPublic: false,
    isDefault: false,
    isAdminRole: false,
    isModeratorRole: true,
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
      canManageRoles: false,
      canManageInstanceSettings: false,
      canManageInstanceBlocks: false,
      canManageUsers: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUserRole: Role = {
    id: "role-user",
    name: "Default User",
    description: "Standard user role",
    color: "#0000ff",
    iconUrl: null,
    displayOrder: 100,
    isPublic: true,
    isDefault: true,
    isAdminRole: false,
    isModeratorRole: false,
    policies: {
      canViewGlobalTimeline: true,
      canViewLocalTimeline: true,
      canPublicNote: true,
      canCreateNote: true,
      canInvite: false,
      inviteLimit: 0,
      rateLimitFactor: 1.0,
      driveCapacityMb: 100,
      maxFileSizeMb: 10,
      canManageReports: false,
      canDeleteNotes: false,
      canSuspendUsers: false,
      canManageRoles: false,
      canManageInstanceSettings: false,
      canManageInstanceBlocks: false,
      canManageUsers: false,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Mock repositories
  let mockRoleRepo: MockRoleRepo;
  let mockRoleAssignmentRepo: MockRoleAssignmentRepo;

  beforeEach(() => {
    mockRoleRepo = {
      findById: mock(() => Promise.resolve(null)),
      findByName: mock(() => Promise.resolve(null)),
      findDefaultRoles: mock(() => Promise.resolve([mockUserRole])),
      findAll: mock(() => Promise.resolve([mockAdminRole, mockModeratorRole, mockUserRole])),
      create: mock((data) =>
        Promise.resolve({
          id: "new-role-id",
          ...data,
          iconUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Role),
      ),
    };

    mockRoleAssignmentRepo = {
      findRolesByUserId: mock(() => Promise.resolve([])),
      hasAdminRole: mock(() => Promise.resolve(false)),
      hasModeratorRole: mock(() => Promise.resolve(false)),
      assign: mock(() =>
        Promise.resolve({
          id: "assignment-id",
          userId: "user1",
          roleId: "role1",
          expiresAt: null,
          assignedById: null,
          createdAt: new Date(),
        }),
      ),
      unassign: mock(() => Promise.resolve(true)),
    };
  });

  describe("getUserRoles", () => {
    test("should return roles assigned to user", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() =>
        Promise.resolve([mockModeratorRole, mockUserRole]),
      );

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const roles = await service.getUserRoles("user1");

      expect(roles).toHaveLength(2);
      expect(roles[0]?.name).toBe("Moderator");
      expect(roles[1]?.name).toBe("Default User");
    });

    test("should return empty array for user with no roles", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const roles = await service.getUserRoles("user-no-roles");

      expect(roles).toHaveLength(0);
    });
  });

  describe("getEffectivePolicies", () => {
    test("should return default policies for user with no assigned roles", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([]));
      mockRoleRepo.findDefaultRoles = mock(() => Promise.resolve([mockUserRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const policies = await service.getEffectivePolicies("user-no-roles");

      expect(policies.canInvite).toBe(false);
      expect(policies.inviteLimit).toBe(0);
      expect(policies.driveCapacityMb).toBe(100);
    });

    test("should merge policies from multiple roles (max values)", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() =>
        Promise.resolve([mockModeratorRole, mockUserRole]),
      );

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const policies = await service.getEffectivePolicies("user-multi-role");

      // Should get the highest values from merged policies
      expect(policies.canInvite).toBe(true); // true from moderator
      expect(policies.inviteLimit).toBe(10); // higher from moderator
      expect(policies.driveCapacityMb).toBe(1000); // higher from moderator
      expect(policies.maxFileSizeMb).toBe(50); // higher from moderator
      expect(policies.canManageReports).toBe(true); // true from moderator
    });

    test("should return admin policies for admin role", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockAdminRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const policies = await service.getEffectivePolicies("admin-user");

      expect(policies.inviteLimit).toBe(-1); // unlimited
      expect(policies.canManageRoles).toBe(true);
      expect(policies.canManageInstanceSettings).toBe(true);
      expect(policies.canManageInstanceBlocks).toBe(true);
      expect(policies.canManageUsers).toBe(true);
    });

    test("should use system defaults when no default roles exist", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([]));
      mockRoleRepo.findDefaultRoles = mock(() => Promise.resolve([]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const policies = await service.getEffectivePolicies("user-no-defaults");

      // Should get system defaults
      expect(policies.canViewGlobalTimeline).toBe(true);
      expect(policies.canViewLocalTimeline).toBe(true);
      expect(policies.canCreateNote).toBe(true);
      expect(policies.canInvite).toBe(false);
    });
  });

  describe("hasPermission", () => {
    test("should return true when user has permission", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockModeratorRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const canInvite = await service.hasPermission("mod-user", "canInvite");
      const canManageReports = await service.hasPermission("mod-user", "canManageReports");

      expect(canInvite).toBe(true);
      expect(canManageReports).toBe(true);
    });

    test("should return false when user lacks permission", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockUserRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const canInvite = await service.hasPermission("regular-user", "canInvite");
      const canManageRoles = await service.hasPermission("regular-user", "canManageRoles");

      expect(canInvite).toBe(false);
      expect(canManageRoles).toBe(false);
    });
  });

  describe("isAdmin", () => {
    test("should return true for user with admin role", async () => {
      mockRoleAssignmentRepo.hasAdminRole = mock(() => Promise.resolve(true));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const isAdmin = await service.isAdmin("admin-user");

      expect(isAdmin).toBe(true);
    });

    test("should return true for user with all admin permissions", async () => {
      mockRoleAssignmentRepo.hasAdminRole = mock(() => Promise.resolve(false));
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockAdminRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const isAdmin = await service.isAdmin("user-with-admin-policies");

      expect(isAdmin).toBe(true);
    });

    test("should return false for regular user", async () => {
      mockRoleAssignmentRepo.hasAdminRole = mock(() => Promise.resolve(false));
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockUserRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const isAdmin = await service.isAdmin("regular-user");

      expect(isAdmin).toBe(false);
    });
  });

  describe("isModerator", () => {
    test("should return true for user with moderator role", async () => {
      mockRoleAssignmentRepo.hasModeratorRole = mock(() => Promise.resolve(true));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const isMod = await service.isModerator("mod-user");

      expect(isMod).toBe(true);
    });

    test("should return true for user with moderation permissions", async () => {
      mockRoleAssignmentRepo.hasModeratorRole = mock(() => Promise.resolve(false));
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockModeratorRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const isMod = await service.isModerator("user-with-mod-permissions");

      expect(isMod).toBe(true);
    });

    test("should return false for regular user", async () => {
      mockRoleAssignmentRepo.hasModeratorRole = mock(() => Promise.resolve(false));
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockUserRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const isMod = await service.isModerator("regular-user");

      expect(isMod).toBe(false);
    });
  });

  describe("canInvite", () => {
    test("should return true for user with canInvite permission", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockModeratorRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const canInvite = await service.canInvite("mod-user");

      expect(canInvite).toBe(true);
    });

    test("should return false for user without canInvite permission", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockUserRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const canInvite = await service.canInvite("regular-user");

      expect(canInvite).toBe(false);
    });
  });

  describe("getInviteLimit", () => {
    test("should return -1 for admin (unlimited)", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockAdminRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const limit = await service.getInviteLimit("admin-user");

      expect(limit).toBe(-1);
    });

    test("should return specific limit for moderator", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockModeratorRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const limit = await service.getInviteLimit("mod-user");

      expect(limit).toBe(10);
    });

    test("should return 0 for user without invite permission", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockUserRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const limit = await service.getInviteLimit("regular-user");

      expect(limit).toBe(0);
    });
  });

  describe("getRateLimitFactor", () => {
    test("should return low factor for admin", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockAdminRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const factor = await service.getRateLimitFactor("admin-user");

      expect(factor).toBe(0.1);
    });

    test("should return default factor for regular user", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockUserRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const factor = await service.getRateLimitFactor("regular-user");

      expect(factor).toBe(1.0);
    });
  });

  describe("getDriveCapacity", () => {
    test("should return high capacity for admin", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockAdminRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const capacity = await service.getDriveCapacity("admin-user");

      expect(capacity).toBe(10000);
    });

    test("should return default capacity for regular user", async () => {
      mockRoleAssignmentRepo.findRolesByUserId = mock(() => Promise.resolve([mockUserRole]));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const capacity = await service.getDriveCapacity("regular-user");

      expect(capacity).toBe(100);
    });
  });

  describe("assignRole and unassignRole", () => {
    test("should assign role to user", async () => {
      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      await service.assignRole("user1", "role1", "admin1");

      expect(mockRoleAssignmentRepo.assign).toHaveBeenCalledWith(
        "user1",
        "role1",
        "admin1",
        undefined,
      );
    });

    test("should assign role with expiry", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      await service.assignRole("user1", "role1", "admin1", expiresAt);

      expect(mockRoleAssignmentRepo.assign).toHaveBeenCalledWith(
        "user1",
        "role1",
        "admin1",
        expiresAt,
      );
    });

    test("should unassign role from user", async () => {
      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const result = await service.unassignRole("user1", "role1");

      expect(result).toBe(true);
      expect(mockRoleAssignmentRepo.unassign).toHaveBeenCalledWith("user1", "role1");
    });
  });

  describe("ensureAdminRole", () => {
    test("should return existing admin role if found", async () => {
      mockRoleRepo.findByName = mock(() => Promise.resolve(mockAdminRole));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const role = await service.ensureAdminRole();

      expect(role.name).toBe("Admin");
      expect(mockRoleRepo.create).not.toHaveBeenCalled();
    });

    test("should create admin role if not found", async () => {
      mockRoleRepo.findByName = mock(() => Promise.resolve(null));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const role = await service.ensureAdminRole();

      expect(role.name).toBe("Admin");
      expect(mockRoleRepo.create).toHaveBeenCalled();
    });
  });

  describe("ensureModeratorRole", () => {
    test("should return existing moderator role if found", async () => {
      mockRoleRepo.findByName = mock(() => Promise.resolve(mockModeratorRole));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const role = await service.ensureModeratorRole();

      expect(role.name).toBe("Moderator");
      expect(mockRoleRepo.create).not.toHaveBeenCalled();
    });

    test("should create moderator role if not found", async () => {
      mockRoleRepo.findByName = mock(() => Promise.resolve(null));

      const service = new RoleService(
        mockRoleRepo as unknown as IRoleRepository,
        mockRoleAssignmentRepo as unknown as IRoleAssignmentRepository,
      );

      const role = await service.ensureModeratorRole();

      expect(role.name).toBe("Moderator");
      expect(mockRoleRepo.create).toHaveBeenCalled();
    });
  });
});
