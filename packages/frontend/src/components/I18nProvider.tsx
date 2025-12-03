"use client";

import { I18nProvider as LinguiI18nProvider } from "@lingui/react";
import { useEffect } from "react";
import { i18n, loadLocale, defaultLocale, type Locale } from "../lib/i18n/index.js";

/**
 * Client-side i18n provider component
 * Wraps children with Lingui's I18nProvider for translation support
 *
 * Uses default locale on SSR/initial render, then switches to user's
 * preferred locale after hydration to prevent hydration mismatch errors
 *
 * @param children - Child components to wrap
 * @returns I18nProvider wrapper
 *
 * @example
 * ```tsx
 * <I18nProvider>
 *   <App />
 * </I18nProvider>
 * ```
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // After hydration, load user's preferred locale from localStorage
    const savedLocale = (localStorage.getItem("locale") as Locale) || defaultLocale;
    if (savedLocale !== defaultLocale) {
      loadLocale(savedLocale);
    }
  }, []);

  // Always render with I18nProvider to avoid Trans component errors
  // On first render (SSR/hydration), use default locale
  // After mount, locale may have changed via useEffect
  return <LinguiI18nProvider i18n={i18n}>{children}</LinguiI18nProvider>;
}
