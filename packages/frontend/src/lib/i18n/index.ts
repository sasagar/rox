/**
 * Internationalization (i18n) configuration and utilities
 * Provides multi-language support using Lingui with English and Japanese locales
 * @module lib/i18n
 */

import { i18n } from "@lingui/core";
import { messages as enMessages } from "../../locales/en/messages.js";

/**
 * Available locales with display names
 */
export const locales = {
  en: "English",
  ja: "日本語",
} as const;

/**
 * Type representing available locale codes
 */
export type Locale = keyof typeof locales;

/**
 * Default locale used when no preference is saved
 */
export const defaultLocale: Locale = "en";

/**
 * Load and activate locale messages
 * English is loaded synchronously, Japanese uses dynamic import for code splitting
 *
 * @param locale - The locale to load ('en' or 'ja')
 *
 * @example
 * ```ts
 * // Switch to Japanese (dynamic import)
 * await loadLocale('ja');
 *
 * // Switch to English (already loaded)
 * await loadLocale('en');
 * ```
 */
export async function loadLocale(locale: Locale) {
  if (locale === "ja") {
    // Dynamic import for Japanese to enable code splitting
    const { messages } = await import("../../locales/ja/messages.js");
    i18n.load(locale, messages);
    i18n.activate(locale);
  } else {
    // English is already loaded (static import)
    i18n.load("en", enMessages);
    i18n.activate("en");
  }
}

// Initialize with default English locale synchronously
i18n.load("en", enMessages);
i18n.activate("en");

// On client side, restore saved locale from localStorage
if (typeof window !== "undefined") {
  const savedLocale = (localStorage.getItem("locale") as Locale) || defaultLocale;
  if (savedLocale !== "en") {
    // Async load non-default locale
    loadLocale(savedLocale).catch((error) => {
      console.error("Failed to load locale:", error);
      // Already using English as fallback
    });
  }
}

/**
 * Lingui i18n instance
 * Use this for programmatic access to translations
 */
export { i18n };
