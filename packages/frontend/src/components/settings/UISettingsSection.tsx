"use client";

/**
 * UI Settings Section Component
 *
 * Allows users to customize their viewing experience:
 * - Font size
 * - Line height
 * - Content width
 * - Theme
 * - Custom CSS
 */

import { useState, useEffect } from "react";
import { useAtom } from "jotai";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import { Settings, Type, AlignJustify, Maximize2, Palette, Code, Volume2 } from "lucide-react";
import { tokenAtom, currentUserAtom } from "../../lib/atoms/auth";
import { uiSettingsAtom } from "../../lib/atoms/uiSettings";
import { apiClient } from "../../lib/api/client";
import { Button } from "../ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/Card";
import { Spinner } from "../ui/Spinner";
import { addToastAtom } from "../../lib/atoms/toast";
import type {
  UISettings,
  FontSize,
  LineHeight,
  ContentWidth,
  Theme,
  NotificationSound,
  NotificationSoundType,
} from "../../lib/types/uiSettings";
import {
  fontSizeLabels,
  lineHeightLabels,
  contentWidthLabels,
  themeLabels,
  notificationSoundLabels,
  notificationTypeLabels,
  defaultUISettings,
} from "../../lib/types/uiSettings";
import { testNotificationSound } from "../../lib/utils/notificationSound";

interface SelectOption<T extends string> {
  value: T;
  label: string;
}

interface SelectGroupProps<T extends string> {
  label: string;
  icon: React.ReactNode;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
}

function SelectGroup<T extends string>({
  label,
  icon,
  value,
  options,
  onChange,
  disabled,
}: SelectGroupProps<T>) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        {icon}
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            disabled={disabled}
            className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
              value === option.value
                ? "bg-primary-500 text-white border-primary-500"
                : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:border-primary-300 dark:hover:border-primary-500"
            } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function UISettingsSection() {
  const [token] = useAtom(tokenAtom);
  const [, setCurrentUser] = useAtom(currentUserAtom);
  const [, addToast] = useAtom(addToastAtom);
  const [uiSettings, setUiSettings] = useAtom(uiSettingsAtom);

  const [localSettings, setLocalSettings] = useState<UISettings>(uiSettings);
  const [appCustomCss, setAppCustomCss] = useState(uiSettings.appCustomCss || "");
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showPerTypeSettings, setShowPerTypeSettings] = useState(false);

  // Sync local state with atom on mount
  useEffect(() => {
    setLocalSettings(uiSettings);
    setAppCustomCss(uiSettings.appCustomCss || "");
  }, [uiSettings]);

  // Track changes
  useEffect(() => {
    const changed =
      localSettings.fontSize !== uiSettings.fontSize ||
      localSettings.lineHeight !== uiSettings.lineHeight ||
      localSettings.contentWidth !== uiSettings.contentWidth ||
      localSettings.theme !== uiSettings.theme ||
      localSettings.notificationSound !== uiSettings.notificationSound ||
      localSettings.notificationVolume !== uiSettings.notificationVolume ||
      JSON.stringify(localSettings.notificationSoundsByType) !==
        JSON.stringify(uiSettings.notificationSoundsByType) ||
      appCustomCss !== (uiSettings.appCustomCss || "");
    setHasChanges(changed);
  }, [localSettings, appCustomCss, uiSettings]);

  const handleSettingChange = <K extends keyof UISettings>(key: K, value: UISettings[K]) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
  };

  /**
   * Update per-notification-type sound setting
   */
  const handlePerTypeSoundChange = (
    notifType: NotificationSoundType,
    sound: NotificationSound,
    volume: number,
  ) => {
    setLocalSettings((prev) => {
      const current = prev.notificationSoundsByType || {};
      // If setting matches default, remove the override
      const defaultSound = prev.notificationSound || defaultUISettings.notificationSound;
      const defaultVolume = prev.notificationVolume ?? defaultUISettings.notificationVolume;

      if (sound === defaultSound && volume === defaultVolume) {
        const { [notifType]: _, ...rest } = current;
        return {
          ...prev,
          notificationSoundsByType: Object.keys(rest).length > 0 ? rest : undefined,
        };
      }

      return {
        ...prev,
        notificationSoundsByType: {
          ...current,
          [notifType]: { sound, volume },
        },
      };
    });
  };

  /**
   * Clear per-type override (use default)
   */
  const handleClearPerTypeOverride = (notifType: NotificationSoundType) => {
    setLocalSettings((prev) => {
      const current = prev.notificationSoundsByType || {};
      const { [notifType]: _, ...rest } = current;
      return {
        ...prev,
        notificationSoundsByType: Object.keys(rest).length > 0 ? rest : undefined,
      };
    });
  };

  const handleSave = async () => {
    if (!token) return;

    setIsSaving(true);
    try {
      apiClient.setToken(token);

      const newSettings: UISettings = {
        ...localSettings,
        appCustomCss: appCustomCss.trim() || undefined,
      };

      // Save to server
      const updatedUser = await apiClient.patch<any>("/api/users/@me", {
        uiSettings: newSettings,
      });

      // Update local state
      setUiSettings(newSettings);
      if (updatedUser) {
        setCurrentUser(updatedUser);
      }

      addToast({
        type: "success",
        message: t`UI settings saved`,
      });
    } catch (err: any) {
      addToast({
        type: "error",
        message: err.message || t`Failed to save UI settings`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setLocalSettings(defaultUISettings);
    setAppCustomCss("");
    setHasChanges(true);
  };

  const fontSizeOptions: SelectOption<FontSize>[] = [
    { value: "small", label: fontSizeLabels.small },
    { value: "medium", label: fontSizeLabels.medium },
    { value: "large", label: fontSizeLabels.large },
    { value: "xlarge", label: fontSizeLabels.xlarge },
  ];

  const lineHeightOptions: SelectOption<LineHeight>[] = [
    { value: "compact", label: lineHeightLabels.compact },
    { value: "normal", label: lineHeightLabels.normal },
    { value: "relaxed", label: lineHeightLabels.relaxed },
  ];

  const contentWidthOptions: SelectOption<ContentWidth>[] = [
    { value: "narrow", label: contentWidthLabels.narrow },
    { value: "normal", label: contentWidthLabels.normal },
    { value: "wide", label: contentWidthLabels.wide },
  ];

  const themeOptions: SelectOption<Theme>[] = [
    { value: "light", label: themeLabels.light },
    { value: "dark", label: themeLabels.dark },
    { value: "system", label: themeLabels.system },
  ];

  const notificationSoundOptions: SelectOption<NotificationSound>[] = [
    { value: "none", label: notificationSoundLabels.none },
    { value: "default", label: notificationSoundLabels.default },
    { value: "soft", label: notificationSoundLabels.soft },
    { value: "bell", label: notificationSoundLabels.bell },
    { value: "pop", label: notificationSoundLabels.pop },
    { value: "chirp", label: notificationSoundLabels.chirp },
    { value: "synth", label: notificationSoundLabels.synth },
    { value: "wood", label: notificationSoundLabels.wood },
    { value: "drop", label: notificationSoundLabels.drop },
  ];

  const handleTestSound = () => {
    const soundType = localSettings.notificationSound || defaultUISettings.notificationSound;
    const volume = localSettings.notificationVolume ?? defaultUISettings.notificationVolume;
    testNotificationSound(soundType, volume);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="w-5 h-5" />
          <Trans>Display Settings</Trans>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 pt-0 space-y-6">
        {/* Font Size */}
        <SelectGroup
          label={t`Font Size`}
          icon={<Type className="w-4 h-4" />}
          value={localSettings.fontSize || defaultUISettings.fontSize}
          options={fontSizeOptions}
          onChange={(value) => handleSettingChange("fontSize", value)}
          disabled={isSaving}
        />

        {/* Line Height */}
        <SelectGroup
          label={t`Line Height`}
          icon={<AlignJustify className="w-4 h-4" />}
          value={localSettings.lineHeight || defaultUISettings.lineHeight}
          options={lineHeightOptions}
          onChange={(value) => handleSettingChange("lineHeight", value)}
          disabled={isSaving}
        />

        {/* Content Width */}
        <SelectGroup
          label={t`Content Width`}
          icon={<Maximize2 className="w-4 h-4" />}
          value={localSettings.contentWidth || defaultUISettings.contentWidth}
          options={contentWidthOptions}
          onChange={(value) => handleSettingChange("contentWidth", value)}
          disabled={isSaving}
        />

        {/* Theme */}
        <SelectGroup
          label={t`Theme`}
          icon={<Palette className="w-4 h-4" />}
          value={localSettings.theme || defaultUISettings.theme}
          options={themeOptions}
          onChange={(value) => handleSettingChange("theme", value)}
          disabled={isSaving}
        />

        {/* Notification Sound */}
        <div className="space-y-3">
          <SelectGroup
            label={t`Notification Sound`}
            icon={<Volume2 className="w-4 h-4" />}
            value={localSettings.notificationSound || defaultUISettings.notificationSound}
            options={notificationSoundOptions}
            onChange={(value) => handleSettingChange("notificationSound", value)}
            disabled={isSaving}
          />

          {/* Volume Slider */}
          {localSettings.notificationSound !== "none" && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 dark:text-gray-400 w-16">
                <Trans>Volume</Trans>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={localSettings.notificationVolume ?? defaultUISettings.notificationVolume}
                onChange={(e) =>
                  handleSettingChange("notificationVolume", parseInt(e.target.value, 10))
                }
                disabled={isSaving}
                className="grow h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
              />
              <span className="text-sm text-gray-600 dark:text-gray-400 w-10 text-right">
                {localSettings.notificationVolume ?? defaultUISettings.notificationVolume}%
              </span>
              <button
                type="button"
                onClick={handleTestSound}
                disabled={isSaving}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trans>Test</Trans>
              </button>
            </div>
          )}

          {/* Per-type notification sound settings toggle */}
          <button
            type="button"
            onClick={() => setShowPerTypeSettings(!showPerTypeSettings)}
            className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
          >
            {showPerTypeSettings ? (
              <Trans>Hide per-type settings</Trans>
            ) : (
              <Trans>Customize sounds per notification type</Trans>
            )}
          </button>

          {/* Per-type notification sound settings */}
          {showPerTypeSettings && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 space-y-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                <Trans>
                  Override the default sound for specific notification types. Leave as default to use
                  the settings above.
                </Trans>
              </p>
              {(
                ["follow", "mention", "reply", "reaction", "renote", "quote"] as NotificationSoundType[]
              ).map((notifType) => {
                const typeSettings = localSettings.notificationSoundsByType?.[notifType];
                const isOverridden = !!typeSettings;
                const currentSound =
                  typeSettings?.sound ||
                  localSettings.notificationSound ||
                  defaultUISettings.notificationSound;
                const currentVolume =
                  typeSettings?.volume ??
                  localSettings.notificationVolume ??
                  defaultUISettings.notificationVolume;

                return (
                  <div
                    key={notifType}
                    className="flex flex-wrap items-center gap-2 py-2 border-b border-gray-200 dark:border-gray-700 last:border-0"
                  >
                    <span className="w-20 text-sm font-medium text-gray-700 dark:text-gray-300">
                      {notificationTypeLabels[notifType]}
                    </span>
                    <select
                      value={currentSound}
                      onChange={(e) =>
                        handlePerTypeSoundChange(
                          notifType,
                          e.target.value as NotificationSound,
                          currentVolume,
                        )
                      }
                      disabled={isSaving}
                      className="px-2 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    >
                      {notificationSoundOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    {currentSound !== "none" && (
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={currentVolume}
                        onChange={(e) =>
                          handlePerTypeSoundChange(
                            notifType,
                            currentSound,
                            parseInt(e.target.value, 10),
                          )
                        }
                        disabled={isSaving}
                        className="w-20 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer accent-primary-500"
                      />
                    )}
                    {currentSound !== "none" && (
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-8">
                        {currentVolume}%
                      </span>
                    )}
                    {isOverridden && (
                      <button
                        type="button"
                        onClick={() => handleClearPerTypeOverride(notifType)}
                        disabled={isSaving}
                        className="px-2 py-0.5 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        title={t`Use default`}
                      >
                        <Trans>Reset</Trans>
                      </button>
                    )}
                    {isOverridden && (
                      <span className="text-xs text-primary-500">
                        <Trans>Custom</Trans>
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Custom CSS */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <Code className="w-4 h-4" />
            <Trans>Custom CSS (App-wide)</Trans>
          </label>
          <textarea
            value={appCustomCss}
            onChange={(e) => setAppCustomCss(e.target.value)}
            placeholder="/* Custom CSS */&#10;.note-card {&#10;  background: #f0f0f0;&#10;}"
            maxLength={10240}
            rows={5}
            disabled={isSaving}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none font-mono text-sm"
          />
          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>
              <Trans>Custom CSS applied to the entire app (max 10KB)</Trans>
            </span>
            <span className={appCustomCss.length > 9000 ? "text-orange-600 font-medium" : ""}>
              {appCustomCss.length.toLocaleString()}/10,240
            </span>
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            <Trans>Note: Some CSS properties may be restricted for security.</Trans>
          </p>
        </div>

        {/* Preview */}
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Trans>Preview</Trans>
          </p>
          <div
            style={{
              fontSize:
                localSettings.fontSize === "small"
                  ? "12px"
                  : localSettings.fontSize === "large"
                    ? "16px"
                    : localSettings.fontSize === "xlarge"
                      ? "18px"
                      : "14px",
              lineHeight:
                localSettings.lineHeight === "compact"
                  ? "1.4"
                  : localSettings.lineHeight === "relaxed"
                    ? "1.8"
                    : "1.6",
            }}
            className="text-gray-600 dark:text-gray-400"
          >
            <Trans>
              This is a preview of how text will appear with your selected settings. Adjust the
              options above to customize your reading experience.
            </Trans>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3 pt-2">
          <Button onPress={handleSave} isDisabled={!hasChanges || isSaving}>
            {isSaving ? (
              <div className="flex items-center gap-2">
                <Spinner size="xs" variant="white" />
                <span>
                  <Trans>Saving...</Trans>
                </span>
              </div>
            ) : (
              <Trans>Save Settings</Trans>
            )}
          </Button>
          <Button variant="secondary" onPress={handleReset} isDisabled={isSaving}>
            <Trans>Reset to Default</Trans>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
