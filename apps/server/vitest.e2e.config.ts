import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    globalSetup: './tests/global-setup.ts',
    include: ['tests/**/*.test.ts'],
    // These need the Cardano devnet; vitest.e2e.cardano.config.ts runs them.
    exclude: [...configDefaults.exclude, 'tests/cardano/**'],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
