import "../styles/globals.css";

import { AppProviders } from "../components/AppProviders.js";
import { ToastContainer } from "../components/ui/Toast";

/**
 * Blocking script to apply UI settings from localStorage before React hydration.
 * This prevents flash of unstyled content (FOUC) for theme, font size, primary color, etc.
 */
const uiSettingsScript = `
(function() {
  try {
    var settings = JSON.parse(localStorage.getItem('rox-ui-settings') || '{}');
    var instanceTheme = JSON.parse(localStorage.getItem('rox-instance-theme') || '{}');
    var html = document.documentElement;

    // Font size mapping
    var fontSizes = { small: '12px', medium: '14px', large: '16px', xlarge: '18px' };
    // Line height mapping
    var lineHeights = { compact: '1.4', normal: '1.6', relaxed: '1.8' };
    // Content width mapping
    var contentWidths = { narrow: '600px', normal: '800px', wide: '1000px' };

    // Apply CSS custom properties
    html.style.setProperty('--rox-font-size', fontSizes[settings.fontSize] || '14px');
    html.style.setProperty('--rox-line-height', lineHeights[settings.lineHeight] || '1.6');
    html.style.setProperty('--rox-content-width', contentWidths[settings.contentWidth] || '800px');

    // Apply theme (light/dark/system)
    var theme = settings.theme || 'system';
    if (theme === 'dark') {
      html.classList.add('dark');
    } else if (theme === 'light') {
      html.classList.remove('dark');
    } else {
      // System preference
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html.classList.add('dark');
      }
    }

    // Apply primary color from cached instance theme
    var primaryColor = instanceTheme.primaryColor;
    if (primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      // Helper functions for color conversion (same as ThemeProvider.tsx)
      function hexToRgb(hex) {
        var result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
        if (!result) return { r: 59, g: 130, b: 246 };
        return { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) };
      }
      function srgbToLinear(c) {
        return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      }
      function rgbToOklch(r, g, b) {
        var rLin = srgbToLinear(r / 255), gLin = srgbToLinear(g / 255), bLin = srgbToLinear(b / 255);
        var l_ = 0.4122214708 * rLin + 0.5363325363 * gLin + 0.0514459929 * bLin;
        var m_ = 0.2119034982 * rLin + 0.6806995451 * gLin + 0.1073969566 * bLin;
        var s_ = 0.0883024619 * rLin + 0.2817188376 * gLin + 0.6299787005 * bLin;
        var lCbrt = Math.cbrt(l_), mCbrt = Math.cbrt(m_), sCbrt = Math.cbrt(s_);
        var L = 0.2104542553 * lCbrt + 0.7936177850 * mCbrt - 0.0040720468 * sCbrt;
        var a = 1.9779984951 * lCbrt - 2.4285922050 * mCbrt + 0.4505937099 * sCbrt;
        var okb = 0.0259040371 * lCbrt + 0.7827717662 * mCbrt - 0.8086757660 * sCbrt;
        var c = Math.sqrt(a * a + okb * okb);
        var h = Math.atan2(okb, a) * (180 / Math.PI);
        if (h < 0) h += 360;
        return { l: Math.round(L * 100) / 100, c: Math.round(c * 100) / 100, h: Math.round(h) };
      }

      var rgb = hexToRgb(primaryColor);
      var oklch = rgbToOklch(rgb.r, rgb.g, rgb.b);
      var baseChroma = Math.min(oklch.c, 0.25);
      var h = oklch.h;

      var style = document.createElement('style');
      style.id = 'rox-theme-colors';
      style.textContent = ':root {' +
        '--color-primary-50: oklch(98% ' + (baseChroma * 0.05).toFixed(3) + ' ' + h + ');' +
        '--color-primary-100: oklch(95% ' + (baseChroma * 0.2).toFixed(3) + ' ' + h + ');' +
        '--color-primary-200: oklch(90% ' + (baseChroma * 0.4).toFixed(3) + ' ' + h + ');' +
        '--color-primary-300: oklch(83% ' + (baseChroma * 0.6).toFixed(3) + ' ' + h + ');' +
        '--color-primary-400: oklch(75% ' + (baseChroma * 0.8).toFixed(3) + ' ' + h + ');' +
        '--color-primary-500: oklch(' + Math.round(oklch.l * 100) + '% ' + baseChroma.toFixed(3) + ' ' + h + ');' +
        '--color-primary-600: oklch(58% ' + (baseChroma * 0.95).toFixed(3) + ' ' + h + ');' +
        '--color-primary-700: oklch(48% ' + (baseChroma * 0.75).toFixed(3) + ' ' + h + ');' +
        '--color-primary-800: oklch(38% ' + (baseChroma * 0.55).toFixed(3) + ' ' + h + ');' +
        '--color-primary-900: oklch(30% ' + (baseChroma * 0.4).toFixed(3) + ' ' + h + ');' +
        '--color-primary-950: oklch(20% ' + (baseChroma * 0.2).toFixed(3) + ' ' + h + ');' +
      '}';
      document.head.appendChild(style);
    }

    // Apply custom CSS if present
    if (settings.appCustomCss) {
      var style = document.createElement('style');
      style.id = 'rox-app-custom-css';
      style.textContent = settings.appCustomCss;
      document.head.appendChild(style);
    }
  } catch (e) {
    // Silently fail - settings will be applied after hydration
  }
})();
`;

/**
 * Root layout component for the application.
 * Wraps all pages with providers for i18n and theming.
 *
 * @param children - Child components to render
 * @returns Root HTML structure
 */
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <meta charSet="utf-8" />
      {/* Blocking script to prevent UI flash - must run before any rendering */}
      <script dangerouslySetInnerHTML={{ __html: uiSettingsScript }} />
      {/* Viewport with maximum-scale=1 prevents iOS zoom on input focus */}
      <meta
        name="viewport"
        content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
      />
      <title>Rox - Lightweight ActivityPub Server</title>

      {/* PWA Meta Tags - manifest is served dynamically from backend */}
      <link rel="manifest" href="/api/instance/manifest.json" />
      <meta name="theme-color" content="#4f46e5" />
      <meta name="mobile-web-app-capable" content="yes" />
      {/* iOS PWA Meta Tags - apple-mobile-web-app-capable is deprecated in iOS 26+ but kept for older versions */}
      <meta name="apple-mobile-web-app-capable" content="yes" />
      {/* black-translucent for transparent status bar on iOS (recommended for iOS 26+) */}
      <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      <meta name="apple-mobile-web-app-title" content="Rox" />

      {/* Apple Touch Icon */}
      <link rel="apple-touch-icon" href="/favicon.png" />

      {/* Favicon */}
      <link rel="icon" type="image/png" href="/favicon.png" />

      <AppProviders>
        {children}
        <ToastContainer />
      </AppProviders>
    </>
  );
}

/**
 * Waku configuration for root layout
 * Marks this layout as statically rendered at build time
 *
 * @returns Configuration object with render mode
 */
export const getConfig = async () => {
  return {
    render: "static",
  };
};
