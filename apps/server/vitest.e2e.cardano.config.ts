import { defineConfig } from 'vitest/config';

// Runs a Cardano-only server against the devnet in testnet/cardano.yml.
export default defineConfig({
  test: {
    globals: true,
    globalSetup: './tests/cardano/global-setup.ts',
    include: ['tests/cardano/**/*.test.ts'],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
