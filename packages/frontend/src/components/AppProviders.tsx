"use client";

/**
 * Application Providers Component
 *
 * Combines all client-side providers (i18n, theme) into a single wrapper
 * for use in the root layout.
 */

import { type ReactNode, useEffect, useState } from "react";
import { useAtomValue } from "jotai";
import { I18nProvider } from "./I18nProvider.js";
import { ThemeProvider } from "./ThemeProvider.js";
import { tokenAtom } from "../lib/atoms/auth";
import { apiClient } from "../lib/api/client";
import type { ThemeSettings } from "../lib/types/instance";

interface AppProvidersProps {
  children: ReactNode;
}

/**
 * Combined application providers
 *
 * Wraps children with:
 * - I18nProvider for internationalization
 * - ThemeProvider for dynamic theming
 *
 * Fetches instance theme settings on mount
 */
export function AppProviders({ children }: AppProvidersProps) {
  const [theme, setTheme] = useState<ThemeSettings | undefined>(undefined);
  const [isLoaded, setIsLoaded] = useState(false);
  const token = useAtomValue(tokenAtom);

  // Sync token to apiClient whenever it changes
  useEffect(() => {
    apiClient.setToken(token);
  }, [token]);

  useEffect(() => {
    // Fetch instance theme settings
    const fetchTheme = async () => {
      try {
        const response = await fetch("/api/instance/theme");
        if (response.ok) {
          const data = await response.json();
          setTheme(data);
        }
      } catch (error) {
        console.error("Failed to fetch theme settings:", error);
      } finally {
        setIsLoaded(true);
      }
    };

    fetchTheme();
  }, []);

  // Show nothing until theme is loaded to prevent flash
  // But still render children to avoid layout shift
  return (
    <I18nProvider>
      <ThemeProvider theme={theme}>
        <div
          className="min-h-screen bg-(--bg-secondary) text-(--text-primary) transition-colors duration-200"
          style={{ opacity: isLoaded ? 1 : 0.99 }}
        >
          {children}
        </div>
      </ThemeProvider>
    </I18nProvider>
  );
}
