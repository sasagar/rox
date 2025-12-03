"use client";

/**
 * Theme Provider Component
 *
 * Provides dynamic theming based on instance settings:
 * - Primary color customization
 * - Dark/Light mode support
 * - System preference detection
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ThemeSettings } from "../lib/types/instance";

type ColorMode = "light" | "dark";

interface ThemeContextValue {
  colorMode: ColorMode;
  primaryColor: string;
  toggleColorMode: () => void;
  setColorMode: (mode: ColorMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Convert HEX color to RGB values
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result || !result[1] || !result[2] || !result[3]) {
    return { r: 59, g: 130, b: 246 }; // Default blue
  }
  return {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  };
}

/**
 * Convert RGB to OKLCH (approximation)
 * This is a simplified conversion for CSS custom properties
 */
function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  // Normalize RGB to 0-1
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;

  // Calculate luminance (simplified)
  const l = 0.2126 * rn + 0.7152 * gn + 0.0722 * bn;

  // Calculate chroma (simplified approximation)
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const c = max - min;

  // Calculate hue
  let h = 0;
  if (c !== 0) {
    if (max === rn) {
      h = ((gn - bn) / c) % 6;
    } else if (max === gn) {
      h = (bn - rn) / c + 2;
    } else {
      h = (rn - gn) / c + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }

  return {
    l: Math.round(l * 100) / 100,
    c: Math.round(c * 0.4 * 100) / 100, // Scale chroma for OKLCH
    h,
  };
}

/**
 * Generate CSS custom properties for primary color palette
 */
function generateColorPalette(hex: string): string {
  const rgb = hexToRgb(hex);
  const { h } = rgbToOklch(rgb.r, rgb.g, rgb.b);

  // Generate palette using OKLCH with varying lightness and chroma
  return `
    --color-primary-50: oklch(98% 0.01 ${h});
    --color-primary-100: oklch(95% 0.04 ${h});
    --color-primary-200: oklch(90% 0.08 ${h});
    --color-primary-300: oklch(83% 0.12 ${h});
    --color-primary-400: oklch(75% 0.16 ${h});
    --color-primary-500: oklch(68% 0.20 ${h});
    --color-primary-600: oklch(58% 0.19 ${h});
    --color-primary-700: oklch(48% 0.15 ${h});
    --color-primary-800: oklch(38% 0.11 ${h});
    --color-primary-900: oklch(30% 0.08 ${h});
    --color-primary-950: oklch(20% 0.04 ${h});
  `;
}

/**
 * Get initial color mode based on settings and system preference
 */
function getInitialColorMode(darkModeSetting: ThemeSettings["darkMode"]): ColorMode {
  if (darkModeSetting === "light" || darkModeSetting === "dark") {
    return darkModeSetting;
  }

  // System preference
  if (typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return "light";
}

interface ThemeProviderProps {
  children: ReactNode;
  theme?: ThemeSettings;
}

/**
 * Theme Provider Component
 *
 * Wraps the application and provides theme context
 */
export function ThemeProvider({ children, theme }: ThemeProviderProps) {
  const defaultTheme: ThemeSettings = {
    primaryColor: "#3b82f6",
    darkMode: "system",
  };

  const themeSettings = theme || defaultTheme;

  const [colorMode, setColorMode] = useState<ColorMode>(() =>
    getInitialColorMode(themeSettings.darkMode),
  );

  // Listen for system color scheme changes
  useEffect(() => {
    if (themeSettings.darkMode !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      setColorMode(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [themeSettings.darkMode]);

  // Apply color mode class to document
  useEffect(() => {
    if (typeof document === "undefined") return;

    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(colorMode);
  }, [colorMode]);

  // Apply primary color CSS variables
  useEffect(() => {
    if (typeof document === "undefined") return;

    const styleId = "rox-theme-colors";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;

    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      :root {
        ${generateColorPalette(themeSettings.primaryColor)}
      }
    `;
  }, [themeSettings.primaryColor]);

  const toggleColorMode = () => {
    setColorMode((prev) => (prev === "light" ? "dark" : "light"));
  };

  const contextValue: ThemeContextValue = {
    colorMode,
    primaryColor: themeSettings.primaryColor,
    toggleColorMode,
    setColorMode,
  };

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
}

/**
 * Hook to access theme context
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
