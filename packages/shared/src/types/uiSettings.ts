/**
 * UI Settings Types
 *
 * Shared type definitions for user UI customization options.
 */

export type FontSize = "small" | "medium" | "large" | "xlarge";
export type LineHeight = "compact" | "normal" | "relaxed";
export type ContentWidth = "narrow" | "normal" | "wide";
export type Theme = "light" | "dark" | "system";

export interface UISettings {
  fontSize?: FontSize;
  lineHeight?: LineHeight;
  contentWidth?: ContentWidth;
  theme?: Theme;
  appCustomCss?: string;
  /** Enable deck mode (multi-column view) */
  deckEnabled?: boolean;
}
