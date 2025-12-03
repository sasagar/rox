/**
 * UI Settings Types
 *
 * Defines the structure for user UI customization options.
 */

export type FontSize = "small" | "medium" | "large" | "xlarge";
export type LineHeight = "compact" | "normal" | "relaxed";
export type ContentWidth = "narrow" | "normal" | "wide";
export type Theme = "light" | "dark" | "system";
export type NotificationSound = "none" | "default" | "soft" | "bell";

export interface UISettings {
  fontSize?: FontSize;
  lineHeight?: LineHeight;
  contentWidth?: ContentWidth;
  theme?: Theme;
  appCustomCss?: string;
  notificationSound?: NotificationSound;
  notificationVolume?: number; // 0-100
}

/**
 * Default UI settings
 */
export const defaultUISettings: Required<Omit<UISettings, "appCustomCss">> & {
  appCustomCss: string;
} = {
  fontSize: "medium",
  lineHeight: "normal",
  contentWidth: "normal",
  theme: "system",
  appCustomCss: "",
  notificationSound: "default",
  notificationVolume: 50,
};

/**
 * CSS variable mappings for each setting
 */
export const fontSizeValues: Record<FontSize, string> = {
  small: "12px",
  medium: "14px",
  large: "16px",
  xlarge: "18px",
};

export const lineHeightValues: Record<LineHeight, string> = {
  compact: "1.4",
  normal: "1.6",
  relaxed: "1.8",
};

export const contentWidthValues: Record<ContentWidth, string> = {
  narrow: "600px",
  normal: "800px",
  wide: "1000px",
};

/**
 * Labels for settings options (for display)
 */
export const fontSizeLabels: Record<FontSize, string> = {
  small: "Small (12px)",
  medium: "Medium (14px)",
  large: "Large (16px)",
  xlarge: "Extra Large (18px)",
};

export const lineHeightLabels: Record<LineHeight, string> = {
  compact: "Compact",
  normal: "Normal",
  relaxed: "Relaxed",
};

export const contentWidthLabels: Record<ContentWidth, string> = {
  narrow: "Narrow (600px)",
  normal: "Normal (800px)",
  wide: "Wide (1000px)",
};

export const themeLabels: Record<Theme, string> = {
  light: "Light",
  dark: "Dark",
  system: "System",
};

export const notificationSoundLabels: Record<NotificationSound, string> = {
  none: "Off",
  default: "Default",
  soft: "Soft",
  bell: "Bell",
};
