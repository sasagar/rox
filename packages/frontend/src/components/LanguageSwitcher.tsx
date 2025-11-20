'use client';

import { useState } from 'react';
import { Button } from 'react-aria-components';
import { loadLocale, locales, type Locale } from '../lib/i18n/index.js';

/**
 * Language switcher component
 * Allows users to switch between available locales
 * Saves the selected locale to localStorage for persistence
 *
 * @example
 * ```tsx
 * <LanguageSwitcher />
 * ```
 */
export function LanguageSwitcher() {
  const [currentLocale, setCurrentLocale] = useState<Locale>(
    (typeof window !== 'undefined'
      ? (localStorage.getItem('locale') as Locale)
      : null) || 'en',
  );

  const handleLocaleChange = (locale: Locale) => {
    loadLocale(locale);
    setCurrentLocale(locale);
    if (typeof window !== 'undefined') {
      localStorage.setItem('locale', locale);
    }
    // Force a page refresh to apply translations throughout the app
    window.location.reload();
  };

  return (
    <div className="flex gap-2">
      {Object.entries(locales).map(([locale, label]) => (
        <Button
          key={locale}
          onPress={() => handleLocaleChange(locale as Locale)}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            currentLocale === locale
              ? 'bg-primary-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          {label}
        </Button>
      ))}
    </div>
  );
}
