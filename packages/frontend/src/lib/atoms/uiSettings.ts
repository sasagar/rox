/**
 * UI Settings Atoms
 *
 * Manages user UI preferences using Jotai atoms.
 */

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { UISettings, Theme } from "../types/uiSettings";
import {
  defaultUISettings,
  fontSizeValues,
  lineHeightValues,
  contentWidthValues,
} from "../types/uiSettings";

/**
 * UI Settings atom with localStorage persistence
 * This stores the user's preferences locally for immediate access
 */
export const uiSettingsAtom = atomWithStorage<UISettings>("rox-ui-settings", defaultUISettings);

/**
 * Derived atom that computes CSS variables from UI settings
 */
export const uiCssVariablesAtom = atom((get) => {
  const settings = get(uiSettingsAtom);

  const fontSize = settings.fontSize || defaultUISettings.fontSize;
  const lineHeight = settings.lineHeight || defaultUISettings.lineHeight;
  const contentWidth = settings.contentWidth || defaultUISettings.contentWidth;

  return {
    "--rox-font-size": fontSizeValues[fontSize],
    "--rox-line-height": lineHeightValues[lineHeight],
    "--rox-content-width": contentWidthValues[contentWidth],
  };
});

/**
 * Theme atom (separate for easier access)
 */
export const themeAtom = atom(
  (get) => get(uiSettingsAtom).theme || defaultUISettings.theme,
  (get, set, newTheme: Theme) => {
    const current = get(uiSettingsAtom);
    set(uiSettingsAtom, { ...current, theme: newTheme });
  },
);

/**
 * Update UI setting atom
 */
export const updateUISettingAtom = atom(null, (get, set, update: Partial<UISettings>) => {
  const current = get(uiSettingsAtom);
  set(uiSettingsAtom, { ...current, ...update });
});

/**
 * App custom CSS atom (derived from UI settings)
 */
export const appCustomCssAtom = atom((get) => get(uiSettingsAtom).appCustomCss || "");

/**
 * Notification sound type atom (derived from UI settings)
 */
export const notificationSoundAtom = atom(
  (get) => get(uiSettingsAtom).notificationSound || defaultUISettings.notificationSound,
);

/**
 * Notification volume atom (derived from UI settings)
 */
export const notificationVolumeAtom = atom(
  (get) => get(uiSettingsAtom).notificationVolume ?? defaultUISettings.notificationVolume,
);
