import type { Config } from 'waku/config';

/**
 * Waku configuration
 * Configures Vite settings for Tailwind CSS v3 (via PostCSS) and Lingui integration
 */
export default {
  /** Vite configuration for all environments */
  vite: {
    ssr: {
      /** Allow Lingui macros to work with SSR by not externalizing them */
      noExternal: ['@lingui/macro'],
    },
    optimizeDeps: {
      /** Optimize Lingui macro for ESM compatibility */
      include: ['@lingui/macro', '@lingui/react'],
    },
  },
} satisfies Config;
