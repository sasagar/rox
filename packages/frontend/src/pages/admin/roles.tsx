'use client';

/**
 * Admin Roles Page
 *
 * Allows administrators to manage roles and permissions.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAtom } from 'jotai';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import { Trash2, Plus, RefreshCw, Edit2, Users, Shield, ShieldCheck } from 'lucide-react';
import { currentUserAtom, tokenAtom } from '../../lib/atoms/auth';
import { apiClient } from '../../lib/api/client';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { InlineError } from '../../components/ui/ErrorMessage';
import { addToastAtom } from '../../lib/atoms/toast';
import { Layout } from '../../components/layout/Layout';

interface RolePolicies {
  canViewGlobalTimeline?: boolean;
  canViewLocalTimeline?: boolean;
  canPublicNote?: boolean;
  canCreateNote?: boolean;
  canInvite?: boolean;
  inviteLimit?: number;
  inviteLimitCycle?: number;
  rateLimitFactor?: number;
  driveCapacityMb?: number;
  maxFileSizeMb?: number;
  canManageReports?: boolean;
  canDeleteNotes?: boolean;
  canSuspendUsers?: boolean;
  canManageRoles?: boolean;
  canManageInstanceSettings?: boolean;
  canManageInstanceBlocks?: boolean;
  canManageUsers?: boolean;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  iconUrl: string | null;
  displayOrder: number;
  isPublic: boolean;
  isDefault: boolean;
  isAdminRole: boolean;
  isModeratorRole: boolean;
  policies: RolePolicies;
  createdAt: string;
  updatedAt: string;
}

interface RolesResponse {
  roles: Role[];
  total: number;
}

export default function AdminRolesPage() {
  const [_currentUser] = useAtom(currentUserAtom);
  const [token] = useAtom(tokenAtom);
  const [, addToast] = useAtom(addToastAtom);

  const [roles, setRoles] = useState<Role[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<Role | null>(null);

  // Create form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: '#3b82f6',
    isPublic: false,
    isDefault: false,
    isAdminRole: false,
    isModeratorRole: false,
    canInvite: false,
    inviteLimit: 0,
    canManageReports: false,
    canDeleteNotes: false,
    canSuspendUsers: false,
  });

  const loadRoles = useCallback(async () => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      const response = await apiClient.get<RolesResponse>('/api/admin/roles');
      setRoles(response.roles);
      setTotal(response.total);
    } catch (err) {
      console.error('Failed to load roles:', err);
      setError('Failed to load roles');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  // Check admin access and load roles
  useEffect(() => {
    const checkAccess = async () => {
      if (!token) {
        window.location.href = '/login';
        return;
      }

      try {
        apiClient.setToken(token);

        // Check if user is admin
        const sessionResponse = await apiClient.get<{ user: any }>('/api/auth/session');
        if (!sessionResponse.user?.isAdmin) {
          window.location.href = '/timeline';
          return;
        }

        await loadRoles();
      } catch (err) {
        console.error('Access check failed:', err);
        setError('Access denied');
        setIsLoading(false);
      }
    };

    checkAccess();
  }, [token, loadRoles]);

  const handleCreateRole = async () => {
    if (!token || !formData.name) return;

    setIsCreating(true);
    try {
      apiClient.setToken(token);

      const policies: RolePolicies = {
        canViewGlobalTimeline: true,
        canViewLocalTimeline: true,
        canPublicNote: true,
        canCreateNote: true,
        canInvite: formData.canInvite,
        inviteLimit: formData.inviteLimit,
        canManageReports: formData.canManageReports,
        canDeleteNotes: formData.canDeleteNotes,
        canSuspendUsers: formData.canSuspendUsers,
      };

      if (editingRole) {
        await apiClient.patch<Role>(`/api/admin/roles/${editingRole.id}`, {
          name: formData.name,
          description: formData.description || undefined,
          color: formData.color,
          isPublic: formData.isPublic,
          isDefault: formData.isDefault,
          isAdminRole: formData.isAdminRole,
          isModeratorRole: formData.isModeratorRole,
          policies,
        });

        addToast({
          type: 'success',
          message: t`Role updated`,
        });
      } else {
        await apiClient.post<Role>('/api/admin/roles', {
          name: formData.name,
          description: formData.description || undefined,
          color: formData.color,
          isPublic: formData.isPublic,
          isDefault: formData.isDefault,
          isAdminRole: formData.isAdminRole,
          isModeratorRole: formData.isModeratorRole,
          policies,
        });

        addToast({
          type: 'success',
          message: t`Role created`,
        });
      }

      // Reset form
      setFormData({
        name: '',
        description: '',
        color: '#3b82f6',
        isPublic: false,
        isDefault: false,
        isAdminRole: false,
        isModeratorRole: false,
        canInvite: false,
        inviteLimit: 0,
        canManageReports: false,
        canDeleteNotes: false,
        canSuspendUsers: false,
      });
      setEditingRole(null);

      // Reload list
      await loadRoles();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || t`Failed to save role`,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEditRole = (role: Role) => {
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || '',
      color: role.color || '#3b82f6',
      isPublic: role.isPublic,
      isDefault: role.isDefault,
      isAdminRole: role.isAdminRole,
      isModeratorRole: role.isModeratorRole,
      canInvite: role.policies.canInvite || false,
      inviteLimit: role.policies.inviteLimit || 0,
      canManageReports: role.policies.canManageReports || false,
      canDeleteNotes: role.policies.canDeleteNotes || false,
      canSuspendUsers: role.policies.canSuspendUsers || false,
    });
  };

  const handleCancelEdit = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      description: '',
      color: '#3b82f6',
      isPublic: false,
      isDefault: false,
      isAdminRole: false,
      isModeratorRole: false,
      canInvite: false,
      inviteLimit: 0,
      canManageReports: false,
      canDeleteNotes: false,
      canSuspendUsers: false,
    });
  };

  const handleDeleteRole = async (id: string) => {
    if (!token) return;

    try {
      apiClient.setToken(token);
      await apiClient.delete(`/api/admin/roles/${id}`);

      addToast({
        type: 'success',
        message: t`Role deleted`,
      });

      // Reload list
      await loadRoles();
    } catch (err: any) {
      addToast({
        type: 'error',
        message: err.message || t`Failed to delete role`,
      });
    }
  };

  const getRoleIcon = (role: Role) => {
    if (role.isAdminRole) return <ShieldCheck className="w-4 h-4 text-red-500" />;
    if (role.isModeratorRole) return <Shield className="w-4 h-4 text-green-500" />;
    return <Users className="w-4 h-4 text-gray-500" />;
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex justify-center items-center min-h-[400px]">
          <Spinner size="lg" />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="max-w-4xl mx-auto p-6">
          <InlineError message={error} />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-(--text-primary)">
            <Trans>Role Management</Trans>
          </h1>
          <p className="text-(--text-secondary) mt-2">
            <Trans>Create and manage user roles with custom permissions</Trans>
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-(--text-primary)">{total}</div>
              <div className="text-sm text-(--text-muted)">
                <Trans>Total Roles</Trans>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-3xl font-bold text-green-500">
                {roles.filter(r => r.isDefault).length}
              </div>
              <div className="text-sm text-(--text-muted)">
                <Trans>Default Roles</Trans>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Create/Edit Role Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>
              {editingRole ? <Trans>Edit Role</Trans> : <Trans>Create Role</Trans>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                  <Trans>Name</Trans>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder={t`Role name`}
                  className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
                  maxLength={50}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                  <Trans>Color</Trans>
                </label>
                <input
                  type="color"
                  value={formData.color}
                  onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  className="w-full h-10 px-1 py-1 border border-(--border-color) rounded-lg bg-(--bg-primary)"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                <Trans>Description</Trans>
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder={t`Role description`}
                className="w-full px-3 py-2 border border-(--border-color) rounded-lg bg-(--bg-primary) text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* Role Type Checkboxes */}
            <div className="grid grid-cols-2 gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isPublic}
                  onChange={(e) => setFormData(prev => ({ ...prev, isPublic: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-(--text-secondary)">
                  <Trans>Public (show on profiles)</Trans>
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isDefault}
                  onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-(--text-secondary)">
                  <Trans>Default (auto-assign to new users)</Trans>
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isAdminRole}
                  onChange={(e) => setFormData(prev => ({ ...prev, isAdminRole: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-(--text-secondary)">
                  <Trans>Admin Role</Trans>
                </span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isModeratorRole}
                  onChange={(e) => setFormData(prev => ({ ...prev, isModeratorRole: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm text-(--text-secondary)">
                  <Trans>Moderator Role</Trans>
                </span>
              </label>
            </div>

            {/* Permissions */}
            <div className="border-t border-(--border-color) pt-4">
              <h3 className="text-sm font-medium text-(--text-primary) mb-3">
                <Trans>Permissions</Trans>
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.canInvite}
                    onChange={(e) => setFormData(prev => ({ ...prev, canInvite: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-(--text-secondary)">
                    <Trans>Can invite users</Trans>
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-(--text-secondary)">
                    <Trans>Invite limit:</Trans>
                  </label>
                  <input
                    type="number"
                    value={formData.inviteLimit}
                    onChange={(e) => setFormData(prev => ({ ...prev, inviteLimit: parseInt(e.target.value) || 0 }))}
                    className="w-20 px-2 py-1 border border-(--border-color) rounded bg-(--bg-primary) text-(--text-primary)"
                    min={-1}
                    disabled={!formData.canInvite}
                  />
                  <span className="text-xs text-(--text-muted)">(-1 = unlimited)</span>
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.canManageReports}
                    onChange={(e) => setFormData(prev => ({ ...prev, canManageReports: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-(--text-secondary)">
                    <Trans>Can manage reports</Trans>
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.canDeleteNotes}
                    onChange={(e) => setFormData(prev => ({ ...prev, canDeleteNotes: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-(--text-secondary)">
                    <Trans>Can delete notes</Trans>
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.canSuspendUsers}
                    onChange={(e) => setFormData(prev => ({ ...prev, canSuspendUsers: e.target.checked }))}
                    className="rounded"
                  />
                  <span className="text-sm text-(--text-secondary)">
                    <Trans>Can suspend users</Trans>
                  </span>
                </label>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onPress={handleCreateRole}
                isDisabled={isCreating || !formData.name}
                className="flex-1"
              >
                {isCreating ? (
                  <Spinner size="sm" />
                ) : editingRole ? (
                  <>
                    <Edit2 className="w-4 h-4 mr-2" />
                    <Trans>Update Role</Trans>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    <Trans>Create Role</Trans>
                  </>
                )}
              </Button>
              {editingRole && (
                <Button
                  variant="secondary"
                  onPress={handleCancelEdit}
                >
                  <Trans>Cancel</Trans>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Role list */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              <Trans>Roles</Trans>
            </CardTitle>
            <Button
              variant="ghost"
              size="sm"
              onPress={loadRoles}
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {roles.length === 0 ? (
              <p className="text-center text-(--text-muted) py-8">
                <Trans>No roles yet</Trans>
              </p>
            ) : (
              <div className="space-y-3">
                {roles.map((role) => {
                  const isBuiltIn = role.name === 'Admin' || role.name === 'Moderator';

                  return (
                    <div
                      key={role.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-(--border-color) bg-(--bg-primary)"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getRoleIcon(role)}
                          <span
                            className="text-lg font-semibold"
                            style={{ color: role.color || 'var(--text-primary)' }}
                          >
                            {role.name}
                          </span>
                          {role.isDefault && (
                            <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded">
                              <Trans>Default</Trans>
                            </span>
                          )}
                          {role.isPublic && (
                            <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded">
                              <Trans>Public</Trans>
                            </span>
                          )}
                        </div>
                        {role.description && (
                          <p className="text-sm text-(--text-muted) mt-1">
                            {role.description}
                          </p>
                        )}
                        <div className="text-xs text-(--text-muted) mt-2 flex flex-wrap gap-2">
                          {role.policies.canInvite && (
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                              <Trans>Invite</Trans>
                            </span>
                          )}
                          {role.policies.canManageReports && (
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                              <Trans>Reports</Trans>
                            </span>
                          )}
                          {role.policies.canDeleteNotes && (
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                              <Trans>Delete Notes</Trans>
                            </span>
                          )}
                          {role.policies.canSuspendUsers && (
                            <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded">
                              <Trans>Suspend Users</Trans>
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => handleEditRole(role)}
                          aria-label={t`Edit role`}
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onPress={() => handleDeleteRole(role.id)}
                          aria-label={t`Delete role`}
                          isDisabled={isBuiltIn}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
