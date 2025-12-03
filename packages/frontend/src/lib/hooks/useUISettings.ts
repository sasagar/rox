/**
 * useUISettings Hook
 *
 * Applies UI settings (font size, line height, content width, theme, custom CSS)
 * to the document. This hook should be used at the root layout level.
 */

import { useEffect } from "react";
import { useAtom } from "jotai";
import { uiCssVariablesAtom, themeAtom, appCustomCssAtom } from "../atoms/uiSettings";
import type { Theme } from "../types/uiSettings";

/**
 * Custom style element ID for app custom CSS
 */
const CUSTOM_CSS_STYLE_ID = "rox-app-custom-css";

/**
 * Apply theme class to document
 */
function applyTheme(theme: Theme) {
  const root = document.documentElement;

  if (theme === "dark") {
    root.classList.add("dark");
  } else if (theme === "light") {
    root.classList.remove("dark");
  } else {
    // System preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }
}

/**
 * Apply custom CSS to document
 */
function applyCustomCss(css: string) {
  let styleElement = document.getElementById(CUSTOM_CSS_STYLE_ID) as HTMLStyleElement | null;

  if (css) {
    if (!styleElement) {
      styleElement = document.createElement("style");
      styleElement.id = CUSTOM_CSS_STYLE_ID;
      document.head.appendChild(styleElement);
    }
    styleElement.textContent = css;
  } else if (styleElement) {
    styleElement.remove();
  }
}

/**
 * Hook to apply UI settings to the document
 *
 * This hook:
 * - Sets CSS custom properties for font size, line height, and content width
 * - Applies theme (light/dark/system)
 * - Injects app custom CSS
 * - Listens for system theme preference changes
 *
 * @example
 * ```tsx
 * function App() {
 *   useUISettings();
 *   return <Layout>...</Layout>;
 * }
 * ```
 */
export function useUISettings() {
  const [cssVariables] = useAtom(uiCssVariablesAtom);
  const [theme] = useAtom(themeAtom);
  const [customCss] = useAtom(appCustomCssAtom);

  // Apply CSS variables
  useEffect(() => {
    const root = document.documentElement;

    Object.entries(cssVariables).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });
  }, [cssVariables]);

  // Apply theme
  useEffect(() => {
    applyTheme(theme);

    // Listen for system preference changes when theme is 'system'
    if (theme === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => applyTheme("system");

      mediaQuery.addEventListener("change", handleChange);
      return () => mediaQuery.removeEventListener("change", handleChange);
    }
    return undefined;
  }, [theme]);

  // Apply custom CSS
  useEffect(() => {
    applyCustomCss(customCss);

    // Cleanup on unmount
    return () => {
      const styleElement = document.getElementById(CUSTOM_CSS_STYLE_ID);
      if (styleElement) {
        styleElement.remove();
      }
    };
  }, [customCss]);
}

export default useUISettings;
