"use client";

import { useState, useRef, useEffect } from "react";
import { Globe } from "lucide-react";
import { loadLocale, locales, type Locale } from "../lib/i18n/index.js";

/**
 * Language switcher component
 * Compact icon button that opens a popover to select language
 *
 * @example
 * ```tsx
 * <LanguageSwitcher />
 * ```
 */
export function LanguageSwitcher() {
  const [currentLocale, setCurrentLocale] = useState<Locale>(
    (typeof window !== "undefined" ? (localStorage.getItem("locale") as Locale) : null) || "en",
  );
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleLocaleChange = async (locale: Locale) => {
    try {
      await loadLocale(locale);
      setCurrentLocale(locale);
      if (typeof window !== "undefined") {
        localStorage.setItem("locale", locale);
      }
      setIsOpen(false);
      // Force a page refresh to apply translations throughout the app
      window.location.reload();
    } catch (error) {
      console.error("Failed to change locale:", error);
    }
  };

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-(--bg-tertiary) transition-colors"
        aria-label="Change language"
        title={`Language: ${locales[currentLocale]}`}
      >
        <Globe className="w-5 h-5" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full mb-2 right-0 bg-(--card-bg) border border-(--border-color) rounded-lg shadow-lg overflow-hidden min-w-[120px] z-50">
          {Object.entries(locales).map(([locale, label]) => (
            <button
              key={locale}
              type="button"
              onClick={() => handleLocaleChange(locale as Locale)}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-(--bg-tertiary) transition-colors ${
                currentLocale === locale
                  ? "bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400"
                  : "text-(--text-primary)"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
