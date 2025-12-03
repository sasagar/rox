import "../styles/globals.css";

import { AppProviders } from "../components/AppProviders.js";
import { ToastContainer } from "../components/ui/Toast";

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
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
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
