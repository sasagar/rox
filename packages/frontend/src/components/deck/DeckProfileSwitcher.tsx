"use client";

import { useState, useCallback, useId } from "react";
import {
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Button as AriaButton,
  Modal,
  Dialog,
  ModalOverlay,
  Heading,
} from "react-aria-components";
import { ChevronDown, Plus, Trash2, Check, Loader2, Pencil } from "lucide-react";
import { Trans, useLingui } from "@lingui/react/macro";
import { Button } from "../ui/Button";
import { useDeckProfiles } from "../../hooks/useDeckProfiles";

/**
 * Profile switcher component for the deck header
 *
 * Allows users to switch between saved deck profiles,
 * create new profiles, edit profile names, and delete existing ones.
 * Syncs with server-side storage.
 */
export function DeckProfileSwitcher() {
  const {
    profiles,
    activeProfile,
    loading,
    createProfile,
    updateProfile,
    deleteProfile,
    setActiveProfile,
  } = useDeckProfiles();

  // Create dialog state
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit dialog state
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editProfileName, setEditProfileName] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Unique IDs for delete dialog accessibility
  const deleteDialogTitleId = useId();
  const deleteDialogDescriptionId = useId();

  const handleOpenCreateDialog = useCallback(() => {
    setNewProfileName("");
    setCreateError(null);
    setIsCreateDialogOpen(true);
  }, []);

  const handleCloseCreateDialog = useCallback(() => {
    setIsCreateDialogOpen(false);
    setNewProfileName("");
    setCreateError(null);
  }, []);

  const handleCreateProfile = useCallback(async () => {
    if (!newProfileName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setCreateError(null);
    try {
      const newProfile = await createProfile({
        name: newProfileName.trim(),
        columns: [],
        isDefault: profiles.length === 0,
      });

      if (newProfile) {
        handleCloseCreateDialog();
      }
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create profile"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [newProfileName, isSubmitting, profiles.length, createProfile, handleCloseCreateDialog]);

  const handleOpenEditDialog = useCallback(() => {
    if (activeProfile) {
      setEditProfileName(activeProfile.name);
      setEditError(null);
      setIsEditDialogOpen(true);
    }
  }, [activeProfile]);

  const handleCloseEditDialog = useCallback(() => {
    setIsEditDialogOpen(false);
    setEditProfileName("");
    setEditError(null);
  }, []);

  const handleEditProfile = useCallback(async () => {
    if (!editProfileName.trim() || isEditing || !activeProfile) return;

    // No change
    if (editProfileName.trim() === activeProfile.name) {
      handleCloseEditDialog();
      return;
    }

    setIsEditing(true);
    setEditError(null);
    try {
      const updated = await updateProfile(activeProfile.id, {
        name: editProfileName.trim(),
      });

      if (updated) {
        handleCloseEditDialog();
      }
    } catch (error) {
      setEditError(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsEditing(false);
    }
  }, [editProfileName, isEditing, activeProfile, updateProfile, handleCloseEditDialog]);

  const handleDeleteProfile = useCallback(
    async (profileId: string) => {
      if (profiles.length <= 1) return;
      setIsDeleting(true);
      setDeleteError(null);
      try {
        await deleteProfile(profileId);
        setDeleteConfirmId(null);
      } catch (error) {
        setDeleteError(
          error instanceof Error ? error.message : "Failed to delete profile"
        );
      } finally {
        setIsDeleting(false);
      }
    },
    [profiles.length, deleteProfile]
  );

  const profileToDelete = deleteConfirmId
    ? profiles.find((p) => p.id === deleteConfirmId)
    : null;

  // Show loading state
  if (loading && profiles.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <Trans>Loading profiles...</Trans>
      </div>
    );
  }

  // If no profiles exist, show create button that opens dialog
  if (profiles.length === 0) {
    return (
      <>
        <Button variant="secondary" size="sm" onPress={handleOpenCreateDialog}>
          <Plus className="w-4 h-4 mr-1" />
          <Trans>Create Profile</Trans>
        </Button>

        {/* Create Profile Dialog */}
        {isCreateDialogOpen && (
          <ProfileFormDialog
            title={<Trans>Create New Profile</Trans>}
            value={newProfileName}
            onChange={setNewProfileName}
            onSubmit={handleCreateProfile}
            onCancel={handleCloseCreateDialog}
            isSubmitting={isSubmitting}
            error={createError}
            submitLabel={<Trans>Create</Trans>}
          />
        )}
      </>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <MenuTrigger>
        <AriaButton className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500">
          <span className="text-gray-900 dark:text-white">
            {activeProfile?.name || "Select Profile"}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-500" />
        </AriaButton>
        <Popover className="z-50">
          <Menu className="min-w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden py-1">
            {profiles.map((profile) => (
              <MenuItem
                key={profile.id}
                onAction={() => setActiveProfile(profile.id)}
                className="flex items-center justify-between px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 outline-none group"
              >
                <span className="flex items-center gap-2">
                  {activeProfile?.id === profile.id && (
                    <Check className="w-4 h-4 text-primary-500" />
                  )}
                  <span
                    className={
                      activeProfile?.id === profile.id
                        ? "font-medium text-primary-600 dark:text-primary-400"
                        : "text-gray-700 dark:text-gray-300"
                    }
                  >
                    {profile.name}
                  </span>
                  {profile.isDefault && (
                    <span className="text-xs text-gray-400">(default)</span>
                  )}
                </span>
              </MenuItem>
            ))}

            {/* Separator */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

            {/* Edit current profile */}
            {activeProfile && (
              <MenuItem
                onAction={handleOpenEditDialog}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 outline-none text-gray-700 dark:text-gray-300"
              >
                <Pencil className="w-4 h-4" />
                <Trans>Rename Profile</Trans>
              </MenuItem>
            )}

            {/* Delete current profile */}
            {profiles.length > 1 && activeProfile && (
              <MenuItem
                onAction={() => setDeleteConfirmId(activeProfile.id)}
                className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 outline-none text-red-600 dark:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
                <Trans>Delete Profile</Trans>
              </MenuItem>
            )}

            {/* Separator */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

            {/* Create new profile */}
            <MenuItem
              onAction={handleOpenCreateDialog}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 outline-none text-gray-700 dark:text-gray-300"
            >
              <Plus className="w-4 h-4" />
              <Trans>New Profile</Trans>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>

      {/* Create Profile Dialog */}
      {isCreateDialogOpen && (
        <ProfileFormDialog
          title={<Trans>Create New Profile</Trans>}
          value={newProfileName}
          onChange={setNewProfileName}
          onSubmit={handleCreateProfile}
          onCancel={handleCloseCreateDialog}
          isSubmitting={isSubmitting}
          error={createError}
          submitLabel={<Trans>Create</Trans>}
        />
      )}

      {/* Edit Profile Dialog */}
      {isEditDialogOpen && (
        <ProfileFormDialog
          title={<Trans>Rename Profile</Trans>}
          value={editProfileName}
          onChange={setEditProfileName}
          onSubmit={handleEditProfile}
          onCancel={handleCloseEditDialog}
          isSubmitting={isEditing}
          error={editError}
          submitLabel={<Trans>Save</Trans>}
        />
      )}

      {/* Delete Confirmation Dialog */}
      {profileToDelete && (
        <ModalOverlay
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              setDeleteConfirmId(null);
              setDeleteError(null);
            }
          }}
          isDismissable={!isDeleting}
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
        >
          <Modal className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl p-6 outline-none">
            <Dialog
              role="alertdialog"
              aria-labelledby={deleteDialogTitleId}
              aria-describedby={deleteDialogDescriptionId}
              className="outline-none"
            >
              <Heading
                slot="title"
                id={deleteDialogTitleId}
                className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4"
              >
                <Trans>Delete Profile</Trans>
              </Heading>
              <p
                id={deleteDialogDescriptionId}
                className="text-gray-700 dark:text-gray-300 mb-6"
              >
                <Trans>
                  Are you sure you want to delete "{profileToDelete.name}"? This
                  will remove all columns and settings for this profile. This
                  action cannot be undone.
                </Trans>
              </p>
              {deleteError && (
                <p className="text-sm text-red-600 dark:text-red-400 mb-4">
                  {deleteError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Button
                  variant="secondary"
                  onPress={() => {
                    setDeleteConfirmId(null);
                    setDeleteError(null);
                  }}
                  isDisabled={isDeleting}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant="danger"
                  onPress={() => handleDeleteProfile(profileToDelete.id)}
                  isDisabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trans>Delete</Trans>
                  )}
                </Button>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
    </div>
  );
}

/**
 * Reusable dialog component for profile creation and editing
 * Uses React Aria Modal/Dialog for proper accessibility
 */
interface ProfileFormDialogProps {
  title: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isSubmitting: boolean;
  error: string | null;
  submitLabel: React.ReactNode;
}

function ProfileFormDialog({
  title,
  value,
  onChange,
  onSubmit,
  onCancel,
  isSubmitting,
  error,
  submitLabel,
}: ProfileFormDialogProps) {
  const { t } = useLingui();
  const titleId = useId();

  return (
    <ModalOverlay
      isOpen
      onOpenChange={(isOpen) => {
        if (!isOpen) onCancel();
      }}
      isDismissable={!isSubmitting}
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
    >
      <Modal className="w-full max-w-md rounded-lg bg-white dark:bg-gray-800 shadow-xl p-6 outline-none">
        <Dialog aria-labelledby={titleId} className="outline-none">
          <Heading
            slot="title"
            id={titleId}
            className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4"
          >
            {title}
          </Heading>
          <div className="mb-6">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={t`Profile name`}
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === "Enter") onSubmit();
                if (e.key === "Escape" && !isSubmitting) onCancel();
              }}
            />
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onPress={onCancel}
              isDisabled={isSubmitting}
            >
              <Trans>Cancel</Trans>
            </Button>
            <Button
              variant="primary"
              onPress={onSubmit}
              isDisabled={isSubmitting || !value.trim()}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                submitLabel
              )}
            </Button>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
