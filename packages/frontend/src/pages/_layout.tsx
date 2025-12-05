import "../styles/globals.css";

import { AppProviders } from "../components/AppProviders.js";
import { ToastContainer } from "../components/ui/Toast";

/**
 * Blocking script to apply UI settings from localStorage before React hydration.
 * This prevents flash of unstyled content (FOUC) for theme, font size, etc.
 */
const uiSettingsScript = `
(function() {
  try {
    var settings = JSON.parse(localStorage.getItem('rox-ui-settings') || '{}');
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
