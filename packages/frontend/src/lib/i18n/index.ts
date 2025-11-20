/**
 * Internationalization (i18n) configuration and utilities
 * Provides multi-language support using Lingui with English and Japanese locales
 * @module lib/i18n
 */

import { i18n } from '@lingui/core';
import { messages as enMessages } from '../../locales/en/messages.js';
import { messages as jaMessages } from '../../locales/ja/messages.js';

/**
 * Available locales with display names
 */
export const locales = {
  en: 'English',
  ja: '日本語',
} as const;

/**
 * Type representing available locale codes
 */
export type Locale = keyof typeof locales;

/**
 * Default locale used when no preference is saved
 */
export const defaultLocale: Locale = 'en';

/**
 * Load and activate locale messages
 *
 * @param locale - The locale to load ('en' or 'ja')
 *
 * @example
 * ```ts
 * // Switch to Japanese
 * loadLocale('ja');
 *
 * // Switch to English
 * loadLocale('en');
 * ```
 */
export function loadLocale(locale: Locale) {
  const messages = locale === 'ja' ? jaMessages : enMessages;
  i18n.load(locale, messages);
  i18n.activate(locale);
}

// Initialize with default locale
// On client side, restore saved locale from localStorage
// On server side, use default locale
if (typeof window !== 'undefined') {
  const savedLocale = (localStorage.getItem('locale') as Locale) || defaultLocale;
  loadLocale(savedLocale);
} else {
  loadLocale(defaultLocale);
}

/**
 * Lingui i18n instance
 * Use this for programmatic access to translations
 */
export { i18n };
