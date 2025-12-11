import "../styles/globals.css";

import { AppProviders } from "../components/AppProviders.js";
import { ToastContainer } from "../components/ui/Toast";

/**
 * Inline CSS for PWA splash screen.
 * This is injected directly into the HTML to ensure it's available immediately,
 * before any CSS files are loaded, preventing flash of unstyled content.
 */
const splashScreenStyles = `
#rox-splash-screen {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #f9fafb;
  transition: opacity 0.3s ease-out, visibility 0.3s ease-out;
}
@media (prefers-color-scheme: dark) {
  #rox-splash-screen {
    background: #111827;
  }
}
#rox-splash-screen.hidden {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
#rox-splash-screen .splash-icon {
  width: 96px;
  height: 96px;
  border-radius: 24px;
  background: white;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  animation: splash-bounce 1s ease-in-out infinite;
}
@media (prefers-color-scheme: dark) {
  #rox-splash-screen .splash-icon {
    background: #1f2937;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }
}
#rox-splash-screen .splash-icon img {
  width: 72px;
  height: 72px;
  object-fit: contain;
}
#rox-splash-screen .splash-icon svg {
  width: 48px;
  height: 48px;
  color: #4f46e5;
}
#rox-splash-screen .splash-title {
  font-family: "M PLUS Rounded 1c", system-ui, -apple-system, sans-serif;
  font-size: 28px;
  font-weight: 700;
  color: #111827;
  margin-bottom: 8px;
  letter-spacing: -0.5px;
}
@media (prefers-color-scheme: dark) {
  #rox-splash-screen .splash-title {
    color: #f9fafb;
  }
}
#rox-splash-screen .splash-subtitle {
  font-family: "M PLUS Rounded 1c", system-ui, -apple-system, sans-serif;
  font-size: 14px;
  color: #6b7280;
}
@media (prefers-color-scheme: dark) {
  #rox-splash-screen .splash-subtitle {
    color: #9ca3af;
  }
}
#rox-splash-screen .splash-loader {
  width: 40px;
  height: 40px;
  margin-top: 32px;
  border: 3px solid #e5e7eb;
  border-top-color: #4f46e5;
  border-radius: 50%;
  animation: splash-spin 0.8s linear infinite;
}
@media (prefers-color-scheme: dark) {
  #rox-splash-screen .splash-loader {
    border-color: #374151;
    border-top-color: #818cf8;
  }
}
@keyframes splash-spin {
  to { transform: rotate(360deg); }
}
@keyframes splash-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
/* Only show splash screen in PWA standalone mode */
@media not all and (display-mode: standalone) {
  #rox-splash-screen {
    display: none;
  }
}
/* Hide splash if already shown this session */
#rox-splash-screen.session-shown {
  display: none;
}
`;

/**
 * Blocking script to check if splash screen should be shown.
 * Uses sessionStorage to track if splash was already shown this session.
 * This ensures splash only appears on PWA cold start, not on page navigation.
 */
const splashCheckScript = `
(function() {
  try {
    var splash = document.getElementById('rox-splash-screen');
    if (!splash) return;

    // Check if we're in standalone mode
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches ||
                       window.navigator.standalone === true;

    if (!isStandalone) {
      // Not in PWA mode, splash is already hidden by CSS
      return;
    }

    // Check if splash was already shown this session
    var wasShown = sessionStorage.getItem('rox-splash-shown');
    if (wasShown) {
      // Already shown this session, hide immediately
      splash.classList.add('session-shown');
    } else {
      // First load this session, mark as shown
      sessionStorage.setItem('rox-splash-shown', '1');
    }
  } catch (e) {
    // Silently fail - splash will be shown
  }
})();
`;

/**
 * Blocking script to apply UI settings from localStorage before React hydration.
 *
 * IMPORTANT: This script MUST NOT modify any DOM elements that React hydrates (html, head, body).
 * Instead, it injects <style> tags into <head> which doesn't cause hydration mismatches.
 *
 * Theme (dark/light) class and CSS custom properties on <html> are handled by
 * ThemeProvider.tsx and UiSettingsProvider.tsx after hydration completes.
 * This causes a brief flash but avoids React Hydration Error #418.
 */
const uiSettingsScript = `
(function() {
  try {
    var settings = JSON.parse(localStorage.getItem('rox-ui-settings') || '{}');
    var instanceTheme = JSON.parse(localStorage.getItem('rox-instance-theme') || '{}');

    // Font size mapping
    var fontSizes = { small: '12px', medium: '14px', large: '16px', xlarge: '18px' };
    // Line height mapping
    var lineHeights = { compact: '1.4', normal: '1.6', relaxed: '1.8' };
    // Content width mapping
    var contentWidths = { narrow: '600px', normal: '800px', wide: '1000px' };

    // Build CSS for UI settings (inject via <style> tag, not html.style)
    var cssVars = ':root {' +
      '--rox-font-size: ' + (fontSizes[settings.fontSize] || '14px') + ';' +
      '--rox-line-height: ' + (lineHeights[settings.lineHeight] || '1.6') + ';' +
      '--rox-content-width: ' + (contentWidths[settings.contentWidth] || '800px') + ';' +
    '}';

    var uiStyle = document.createElement('style');
    uiStyle.id = 'rox-ui-settings-vars';
    uiStyle.textContent = cssVars;
    document.head.appendChild(uiStyle);

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

    // Update theme-color meta tag for PWA
    if (primaryColor && /^#[0-9A-Fa-f]{6}$/.test(primaryColor)) {
      var themeColorMeta = document.querySelector('meta[name="theme-color"]');
      if (themeColorMeta) {
        themeColorMeta.setAttribute('content', primaryColor);
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
      {/* Splash screen styles - must be inline for immediate availability */}
      <style dangerouslySetInnerHTML={{ __html: splashScreenStyles }} />
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

      {/* Apple Touch Icon - uses dynamic endpoint that redirects to configured PWA icon */}
      <link rel="apple-touch-icon" href="/api/instance/apple-touch-icon.png" />

      {/* Favicon */}
      <link rel="icon" type="image/png" href="/favicon.png" />

      {/* Google Fonts - M PLUS Rounded 1c */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link
        href="https://fonts.googleapis.com/css2?family=M+PLUS+Rounded+1c:wght@300;400;500;700&display=swap"
        rel="stylesheet"
      />

      {/* PWA Splash Screen - shown only in standalone mode until app loads */}
      <div id="rox-splash-screen">
        <div className="splash-icon">
          <img src="/api/instance/apple-touch-icon.png" alt="" />
        </div>
        <div className="splash-title">Rox</div>
        <div className="splash-subtitle">Loading...</div>
        <div className="splash-loader" />
      </div>
      {/* Check if splash should be shown (only on PWA cold start) */}
      <script dangerouslySetInnerHTML={{ __html: splashCheckScript }} />

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
