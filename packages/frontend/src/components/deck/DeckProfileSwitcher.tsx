"use client";

import { useState, useCallback } from "react";
import {
  Menu,
  MenuItem,
  MenuTrigger,
  Popover,
  Button as AriaButton,
} from "react-aria-components";
import { ChevronDown, Plus, Trash2, Check, Loader2 } from "lucide-react";
import { Trans } from "@lingui/react/macro";
import { Button } from "../ui/Button";
import { useDeckProfiles } from "../../hooks/useDeckProfiles";

/**
 * Profile switcher component for the deck header
 *
 * Allows users to switch between saved deck profiles,
 * create new profiles, and delete existing ones.
 * Syncs with server-side storage.
 */
export function DeckProfileSwitcher() {
  const {
    profiles,
    activeProfile,
    loading,
    createProfile,
    deleteProfile,
    setActiveProfile,
  } = useDeckProfiles();

  const [isCreating, setIsCreating] = useState(false);
  const [newProfileName, setNewProfileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreateProfile = useCallback(async () => {
    if (!newProfileName.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const newProfile = await createProfile({
        name: newProfileName.trim(),
        columns: [],
        isDefault: profiles.length === 0,
      });

      if (newProfile) {
        setNewProfileName("");
        setIsCreating(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [newProfileName, isSubmitting, profiles.length, createProfile]);

  const handleDeleteProfile = useCallback(
    async (profileId: string) => {
      if (profiles.length <= 1) return;
      await deleteProfile(profileId);
    },
    [profiles.length, deleteProfile]
  );

  // Show loading state
  if (loading && profiles.length === 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500">
        <Loader2 className="w-4 h-4 animate-spin" />
        <Trans>Loading profiles...</Trans>
      </div>
    );
  }

  // If no profiles exist, show create prompt
  if (profiles.length === 0) {
    return (
      <div className="flex items-center gap-2">
        {isCreating ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newProfileName}
              onChange={(e) => setNewProfileName(e.target.value)}
              placeholder="Profile name"
              className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
              disabled={isSubmitting}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateProfile();
                if (e.key === "Escape") setIsCreating(false);
              }}
            />
            <Button
              variant="primary"
              size="sm"
              onPress={handleCreateProfile}
              isDisabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trans>Create</Trans>
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => setIsCreating(false)}
              isDisabled={isSubmitting}
            >
              <Trans>Cancel</Trans>
            </Button>
          </div>
        ) : (
          <Button variant="secondary" size="sm" onPress={() => setIsCreating(true)}>
            <Plus className="w-4 h-4 mr-1" />
            <Trans>Create Profile</Trans>
          </Button>
        )}
      </div>
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

            {/* Delete action as separate menu item for accessibility */}
            {profiles.length > 1 && activeProfile && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                <MenuItem
                  onAction={() => handleDeleteProfile(activeProfile.id)}
                  className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20 outline-none text-red-600 dark:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                  <Trans>Delete Current Profile</Trans>
                </MenuItem>
              </>
            )}

            {/* Separator */}
            <div className="border-t border-gray-200 dark:border-gray-700 my-1" />

            {/* Create new profile */}
            <MenuItem
              onAction={() => setIsCreating(true)}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 outline-none text-gray-700 dark:text-gray-300"
            >
              <Plus className="w-4 h-4" />
              <Trans>New Profile</Trans>
            </MenuItem>
          </Menu>
        </Popover>
      </MenuTrigger>

      {/* Inline create form */}
      {isCreating && (
        <div className="flex items-center gap-2 ml-2">
          <input
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="Profile name"
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            autoFocus
            disabled={isSubmitting}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateProfile();
              if (e.key === "Escape") {
                setIsCreating(false);
                setNewProfileName("");
              }
            }}
          />
          <Button
            variant="primary"
            size="sm"
            onPress={handleCreateProfile}
            isDisabled={isSubmitting}
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trans>Create</Trans>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => {
              setIsCreating(false);
              setNewProfileName("");
            }}
            isDisabled={isSubmitting}
          >
            <Trans>Cancel</Trans>
          </Button>
        </div>
      )}
    </div>
  );
}
