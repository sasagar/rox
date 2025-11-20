'use client';

import { I18nProvider as LinguiI18nProvider } from '@lingui/react';
import { i18n } from '../lib/i18n/index.js';

/**
 * Client-side i18n provider component
 * Wraps children with Lingui's I18nProvider for translation support
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
  return <LinguiI18nProvider i18n={i18n}>{children}</LinguiI18nProvider>;
}
