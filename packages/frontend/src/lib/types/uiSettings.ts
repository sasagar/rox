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

/**
 * Notification types that can have individual sound settings
 */
export type NotificationSoundType =
  | "follow"
  | "mention"
  | "reply"
  | "reaction"
  | "renote"
  | "quote";

/**
 * Per-notification-type sound settings
 */
export interface NotificationSoundSettings {
  sound: NotificationSound;
  volume: number; // 0-100
}

/**
 * Map of notification type to sound settings
 */
export type NotificationSoundsByType = Partial<Record<NotificationSoundType, NotificationSoundSettings>>;

export interface UISettings {
  fontSize?: FontSize;
  lineHeight?: LineHeight;
  contentWidth?: ContentWidth;
  theme?: Theme;
  appCustomCss?: string;
  notificationSound?: NotificationSound;
  notificationVolume?: number; // 0-100
  /** Per-notification-type sound settings (overrides default) */
  notificationSoundsByType?: NotificationSoundsByType;
}

/**
 * Default UI settings
 */
export const defaultUISettings: Required<Omit<UISettings, "appCustomCss" | "notificationSoundsByType">> & {
  appCustomCss: string;
  notificationSoundsByType: NotificationSoundsByType | undefined;
} = {
  fontSize: "medium",
  lineHeight: "normal",
  contentWidth: "normal",
  theme: "system",
  appCustomCss: "",
  notificationSound: "default",
  notificationVolume: 50,
  notificationSoundsByType: undefined,
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

/**
 * Labels for notification types (for display)
 */
export const notificationTypeLabels: Record<NotificationSoundType, string> = {
  follow: "Follow",
  mention: "Mention",
  reply: "Reply",
  reaction: "Reaction",
  renote: "Renote",
  quote: "Quote",
};
