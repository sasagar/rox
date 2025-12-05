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
 * Convert sRGB to linear RGB
 */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/**
 * Convert RGB to OKLCH using proper color space transformation
 * Based on the OKLCH specification: https://www.w3.org/TR/css-color-4/#ok-lab
 */
function rgbToOklch(r: number, g: number, b: number): { l: number; c: number; h: number } {
  // Normalize RGB to 0-1 and convert to linear RGB
  const rLin = srgbToLinear(r / 255);
  const gLin = srgbToLinear(g / 255);
  const bLin = srgbToLinear(b / 255);

  // Convert linear RGB to OKLab using the matrix transformation
  // First: linear RGB to LMS (cone response)
  const l_ = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
  const m_ = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
  const s_ = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;

  // Apply cube root (perceptual response)
  const lCbrt = Math.cbrt(l_);
  const mCbrt = Math.cbrt(m_);
  const sCbrt = Math.cbrt(s_);

  // LMS to OKLab
  const L = 0.2104542553 * lCbrt + 0.7936177850 * mCbrt - 0.0040720468 * sCbrt;
  const a = 1.9779984951 * lCbrt - 2.4285922050 * mCbrt + 0.4505937099 * sCbrt;
  const okb = 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.8086757660 * sCbrt;

  // OKLab to OKLCH
  const c = Math.sqrt(a * a + okb * okb);
  let h = Math.atan2(okb, a) * (180 / Math.PI);
  if (h < 0) h += 360;

  return {
    l: Math.round(L * 100) / 100,
    c: Math.round(c * 100) / 100,
    h: Math.round(h),
  };
}

/**
 * Generate CSS custom properties for primary color palette
 * Uses the actual OKLCH values from the color and creates a palette with varying lightness
 */
function generateColorPalette(hex: string): string {
  const rgb = hexToRgb(hex);
  const { l, c, h } = rgbToOklch(rgb.r, rgb.g, rgb.b);

  // Calculate base chroma - scale relative to the original color's chroma
  // The 500 level should match the original color's chroma
  const baseChroma = Math.min(c, 0.25); // Cap chroma to avoid out-of-gamut colors

  // Generate palette using OKLCH with varying lightness and proportional chroma
  // Lighter shades have less chroma, darker shades transition down
  return `
    --color-primary-50: oklch(98% ${(baseChroma * 0.05).toFixed(3)} ${h});
    --color-primary-100: oklch(95% ${(baseChroma * 0.2).toFixed(3)} ${h});
    --color-primary-200: oklch(90% ${(baseChroma * 0.4).toFixed(3)} ${h});
    --color-primary-300: oklch(83% ${(baseChroma * 0.6).toFixed(3)} ${h});
    --color-primary-400: oklch(75% ${(baseChroma * 0.8).toFixed(3)} ${h});
    --color-primary-500: oklch(${Math.round(l * 100)}% ${baseChroma.toFixed(3)} ${h});
    --color-primary-600: oklch(58% ${(baseChroma * 0.95).toFixed(3)} ${h});
    --color-primary-700: oklch(48% ${(baseChroma * 0.75).toFixed(3)} ${h});
    --color-primary-800: oklch(38% ${(baseChroma * 0.55).toFixed(3)} ${h});
    --color-primary-900: oklch(30% ${(baseChroma * 0.4).toFixed(3)} ${h});
    --color-primary-950: oklch(20% ${(baseChroma * 0.2).toFixed(3)} ${h});
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
