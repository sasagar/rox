import { defineConfig } from '@lingui/cli';

export default defineConfig({
  locales: ['en', 'ja'],
  sourceLocale: 'en',
  catalogs: [
    {
      path: '<rootDir>/src/locales/{locale}/messages',
      include: ['src'],
      exclude: ['**/node_modules/**', '**/entries.tsx'],
    },
  ],
  format: 'po',
  compileNamespace: 'ts',
});
