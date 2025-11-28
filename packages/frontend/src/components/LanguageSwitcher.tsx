'use client';

import { useState } from 'react';
import {
  Select,
  Label,
  Button,
  SelectValue,
  Popover,
  ListBox,
  ListBoxItem,
} from 'react-aria-components';
import { ChevronDown } from 'lucide-react';
import { loadLocale, locales, type Locale } from '../lib/i18n/index.js';

/**
 * Language switcher component
 * Allows users to switch between available locales using a select box
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

  const handleLocaleChange = async (locale: Locale) => {
    try {
      await loadLocale(locale);
      setCurrentLocale(locale);
      if (typeof window !== 'undefined') {
        localStorage.setItem('locale', locale);
      }
      // Force a page refresh to apply translations throughout the app
      window.location.reload();
    } catch (error) {
      console.error('Failed to change locale:', error);
    }
  };

  return (
    <Select
      selectedKey={currentLocale}
      onSelectionChange={(key) => handleLocaleChange(key as Locale)}
      className="w-full"
    >
      <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block">Language</Label>
      <Button className="w-full flex items-center justify-between px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
        <SelectValue className="flex-1 text-left" />
        <ChevronDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
      </Button>
      <Popover className="w-[--trigger-width] mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg overflow-hidden">
        <ListBox className="outline-none">
          {Object.entries(locales).map(([locale, label]) => (
            <ListBoxItem
              key={locale}
              id={locale}
              className="px-3 py-2 text-sm text-gray-900 dark:text-gray-100 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none data-selected:bg-primary-50 dark:data-selected:bg-primary-900/30 data-selected:text-primary-900 dark:data-selected:text-primary-100"
            >
              {label}
            </ListBoxItem>
          ))}
        </ListBox>
      </Popover>
    </Select>
  );
}
