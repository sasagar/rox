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
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Rox - Lightweight ActivityPub Server</title>
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
