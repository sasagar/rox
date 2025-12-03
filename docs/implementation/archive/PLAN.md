# Implementation Plan: Role System, Instance Settings, and Moderation Enhancements

> **Status: ✅ COMPLETED** (November 2025)
>
> All phases have been implemented and tested. See the Implementation Status section below for details.

## Overview

This plan implements:
1. ✅ Misskey-style role-based permission system
2. ✅ Instance settings management (invite-only mode via admin UI instead of env var)
3. ✅ Role-based invitation code generation permission
4. ✅ Instance block management UI (frontend)
5. ✅ User report system (backend + frontend)
6. ✅ Public role badges on user profiles
7. ✅ User-facing invitation code generation in settings

## Phase 1: Database Schema Changes

### New Tables

#### 1. `roles` - Role definitions
```sql
CREATE TABLE roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  color TEXT, -- For UI display (hex color)
  icon TEXT, -- Optional icon identifier
  display_order INTEGER NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT false, -- Show on user profiles
  is_default BOOLEAN NOT NULL DEFAULT false, -- Auto-assign to new users
  is_admin_role BOOLEAN NOT NULL DEFAULT false, -- Full admin access
  is_moderator_role BOOLEAN NOT NULL DEFAULT false, -- Moderation access
  policies JSONB NOT NULL DEFAULT '{}', -- Role permissions/limits
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

#### 2. `role_assignments` - User-role assignments
```sql
CREATE TABLE role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  expires_at TIMESTAMP, -- Optional expiry for temporary roles
  assigned_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);
```

#### 3. `instance_settings` - Instance-wide settings
```sql
CREATE TABLE instance_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_by_id TEXT REFERENCES users(id) ON DELETE SET NULL
);
```

### Role Policies Structure (JSONB)

```typescript
interface RolePolicies {
  // Timeline access
  canViewGlobalTimeline?: boolean;
  canViewLocalTimeline?: boolean;

  // Note creation
  canPublicNote?: boolean;
  canCreateNote?: boolean;

  // Invitations
  canInvite?: boolean;
  inviteLimit?: number; // -1 for unlimited
  inviteLimitCycle?: number; // Hours between resets

  // Rate limits (multiplier, 1.0 = default)
  rateLimitFactor?: number;

  // Drive/storage
  driveCapacityMb?: number;
  maxFileSizeMb?: number;

  // Moderation
  canManageReports?: boolean;
  canDeleteNotes?: boolean;
  canSuspendUsers?: boolean;

  // Instance management (admin only)
  canManageRoles?: boolean;
  canManageInstanceSettings?: boolean;
  canManageInstanceBlocks?: boolean;
}
```

### Instance Settings Keys

```typescript
type InstanceSettingKey =
  | 'registration.enabled'       // boolean
  | 'registration.inviteOnly'    // boolean
  | 'registration.approvalRequired' // boolean (future)
  | 'instance.name'              // string
  | 'instance.description'       // string
  | 'instance.maintainerEmail'   // string
```

## Phase 2: Backend Implementation

### New Files

1. **Schema**: `packages/backend/src/db/schema/pg.ts`
   - Add `roles`, `roleAssignments`, `instanceSettings` tables

2. **Interfaces**:
   - `packages/backend/src/interfaces/repositories/IRoleRepository.ts`
   - `packages/backend/src/interfaces/repositories/IRoleAssignmentRepository.ts`
   - `packages/backend/src/interfaces/repositories/IInstanceSettingsRepository.ts`

3. **Repositories**:
   - `packages/backend/src/repositories/pg/PostgresRoleRepository.ts`
   - `packages/backend/src/repositories/pg/PostgresRoleAssignmentRepository.ts`
   - `packages/backend/src/repositories/pg/PostgresInstanceSettingsRepository.ts`

4. **Services**:
   - `packages/backend/src/services/RoleService.ts` - Compute effective policies
   - `packages/backend/src/services/InstanceSettingsService.ts` - Manage instance settings

5. **Routes**:
   - Update `packages/backend/src/routes/admin.ts` - Add role and settings management
   - Update `packages/backend/src/routes/auth.ts` - Use instance settings for invite-only

6. **Middleware**:
   - Update `packages/backend/src/middleware/auth.ts` - Add `requirePermission()` middleware

### Key Implementation Details

#### RoleService
```typescript
class RoleService {
  // Get all roles assigned to a user
  async getUserRoles(userId: string): Promise<Role[]>;

  // Compute effective policies (merge all role policies with priority)
  async getEffectivePolicies(userId: string): Promise<RolePolicies>;

  // Check if user has specific permission
  async hasPermission(userId: string, permission: keyof RolePolicies): Promise<boolean>;

  // Assign/unassign roles
  async assignRole(userId: string, roleId: string, assignedBy: string, expiresAt?: Date): Promise<void>;
  async unassignRole(userId: string, roleId: string): Promise<void>;
}
```

#### InstanceSettingsService
```typescript
class InstanceSettingsService {
  // Get setting value with type safety
  async get<T>(key: InstanceSettingKey): Promise<T | null>;

  // Set setting value
  async set<T>(key: InstanceSettingKey, value: T, updatedBy: string): Promise<void>;

  // Get all settings
  async getAll(): Promise<Record<string, any>>;

  // Check if registration is invite-only
  async isInviteOnly(): Promise<boolean>;
}
```

#### Updated Auth Flow
```typescript
// In auth.ts register endpoint
const instanceSettings = c.get('instanceSettingsService');
const isInviteOnly = await instanceSettings.isInviteOnly();

if (isInviteOnly) {
  // Require invitation code
}
```

#### Permission Middleware
```typescript
// New middleware for permission checks
export function requirePermission(permission: keyof RolePolicies) {
  return async (c: Context, next: Next) => {
    const user = c.get('user');
    const roleService = c.get('roleService');

    const hasPermission = await roleService.hasPermission(user.id, permission);
    if (!hasPermission) {
      return c.json({ error: 'Permission denied' }, 403);
    }

    return next();
  };
}
```

## Phase 3: API Endpoints

### Role Management (Admin)

```
GET    /api/admin/roles                    - List all roles
POST   /api/admin/roles                    - Create role
GET    /api/admin/roles/:id                - Get role details
PATCH  /api/admin/roles/:id                - Update role
DELETE /api/admin/roles/:id                - Delete role
GET    /api/admin/roles/:id/users          - List users with role
POST   /api/admin/roles/:id/assign/:userId - Assign role to user
DELETE /api/admin/roles/:id/assign/:userId - Unassign role from user
```

### Instance Settings (Admin)

```
GET    /api/admin/settings                 - Get all settings
PATCH  /api/admin/settings                 - Update settings (partial)
GET    /api/admin/settings/:key            - Get specific setting
```

### User Invitation Codes (Based on Role Permission)

```
GET    /api/invitations                    - List user's own invitation codes
POST   /api/invitations                    - Create invitation code (if permitted)
DELETE /api/invitations/:id                - Delete own invitation code
```

### Public API

```
GET    /api/instance/settings              - Get public instance info (name, invite-only, etc.)
```

## Phase 4: Migration Strategy

1. **Default Roles**: Create default roles on first migration:
   - `admin` - Full access (isAdminRole: true)
   - `moderator` - Moderation access (isModeratorRole: true)
   - `default` - Default user role (isDefault: true)

2. **User Migration**:
   - Users with `isAdmin: true` get assigned `admin` role
   - All existing users get assigned `default` role
   - Keep `isAdmin` column for backward compatibility (synced with admin role)

3. **Invitation Code Migration**:
   - Existing codes remain valid
   - Update admin.ts to use permission check instead of requireAdmin

## Phase 5: Frontend (UI) Updates

### Admin Panel Components

1. **Role Management Page** (`/admin/roles`)
   - Role list with drag-to-reorder
   - Create/edit role dialog with policy editor

2. **Instance Settings Page** (`/admin/settings`)
   - Toggle for invite-only mode
   - Instance name/description editor

3. **Instance Block Management** (`/admin/blocks`)
   - List blocked instances
   - Add/remove blocks with reason

### User-facing Updates

1. **User Settings**: Show invitation code generation if permitted
2. **User Profile**: Show public roles as badges

## Implementation Order

1. Database schema and migrations
2. Repository interfaces and implementations
3. RoleService and InstanceSettingsService
4. Update DI container
5. Permission middleware
6. Admin API routes for roles
7. Admin API routes for instance settings
8. Update auth flow for invite-only
9. User invitation API (permission-based)
10. Unit tests
11. Frontend admin pages
12. Integration tests

## Backward Compatibility

- `REQUIRE_INVITATION` env var will continue to work as fallback
- `isAdmin` column will be kept and synced with admin role assignment
- Existing invitation codes and reports remain valid

## Testing Strategy

1. **Unit Tests**:
   - RoleService policy computation
   - Permission middleware
   - InstanceSettingsService

2. **Integration Tests**:
   - Role assignment flow
   - Permission-gated endpoints
   - Invitation code with role permission

## Estimated Changes

- New files: ~15
- Modified files: ~10
- New tests: ~50
- Database migration: 1

---

## Implementation Status (Completed November 2025)

### Phase 1-4: Backend ✅
- [x] Database schema and migrations (roles, role_assignments, instance_settings, invitation_codes, user_reports)
- [x] Repository interfaces and implementations for PostgreSQL
- [x] RoleService and InstanceSettingsService
- [x] DI container setup with all repositories
- [x] Permission middleware (`requirePermission`)
- [x] Admin API routes for roles, instance settings, and instance blocks
- [x] Updated auth flow for invite-only registration
- [x] User invitation API with permission checks

### Phase 5: Frontend Admin UI ✅
- [x] Role management page (`/admin/roles`)
- [x] Instance settings page (`/admin/settings`)
- [x] Instance blocks management (`/admin/blocks`)
- [x] User reports management (`/admin/reports`)

### Phase 6: User-Facing Features ✅
- [x] Public role badges on user profiles (`RoleBadge.tsx`, `RoleBadgeList.tsx`)
- [x] User-facing invitation code generation in settings (`InvitationCodeSection.tsx`)
- [x] Report user/note functionality (`ReportDialog.tsx`)

### Testing ✅
- [x] Unit tests: RoleService, PermissionMiddleware, InstanceSettingsService
- [x] Unit tests: InvitationCodeRepository, UserReportRepository
- [x] Unit tests: InviteOnlyRegistration, InstanceBlockDelivery
- [x] Integration tests with server availability check

### Total Test Results
- **382 tests** passing across 27 test files
- 0 failures
