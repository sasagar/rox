import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";
import { defineConfig } from "waku/config";

/**
 * Waku configuration
 * Configures Vite settings for Tailwind CSS v4 (via Vite plugin) and Lingui integration
 */
export default defineConfig({
  /** Vite configuration for all environments */
  vite: {
    plugins: [
      tailwindcss(),
      react({
        babel: {
          plugins: ["babel-plugin-react-compiler", "@lingui/babel-plugin-lingui-macro"],
        },
      }),
      lingui(),
    ],
    /** Proxy API requests to backend server */
    server: {
      port: 3001,
      proxy: {
        "/api": {
          target: "http://localhost:3000",
          changeOrigin: true,
        },
      },
    },
    ssr: {
      /** Allow Lingui macros to work with SSR by not externalizing them */
      noExternal: ["@lingui/macro", "babel-plugin-macros"],
    },
    optimizeDeps: {
      /** Optimize Lingui macro for ESM compatibility */
      include: ["@lingui/macro", "@lingui/react", "babel-plugin-macros"],
    },
  },
});
