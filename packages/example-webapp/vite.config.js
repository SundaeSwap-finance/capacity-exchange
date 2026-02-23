import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

const REQUIRED_ENV_VARS = ['VITE_NETWORK_ID'];
const VALID_NETWORK_IDS = ['undeployed', 'preview', 'preprod'];

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, import.meta.dirname, 'VITE_');
  for (const key of REQUIRED_ENV_VARS) {
    if (!env[key]) {
      throw new Error(`Missing required environment variable: ${key}`);
    }
  }
  if (!VALID_NETWORK_IDS.includes(env.VITE_NETWORK_ID)) {
    throw new Error(
      `Invalid VITE_NETWORK_ID "${env.VITE_NETWORK_ID}". Must be one of: ${VALID_NETWORK_IDS.join(', ')}.`
    );
  }

  return {
    define: {
      global: 'globalThis',
    },
    plugins: [
      react(),
      wasm(),
      nodePolyfills({
        include: ['process', 'buffer', 'crypto', 'stream', 'events', 'assert'],
        globals: {
          Buffer: true,
          global: true,
          process: true,
        },
      }),
    ],
    build: {
      target: 'esnext',
    },
    server: {
      watch: {
        include: ['../core/src/**/*.{js,ts,jsx,tsx}', '../components/src/**/*.{js,ts,jsx,tsx}'],
      },
    },
    optimizeDeps: {
      include: [
        'vite-plugin-node-polyfills/shims/buffer',
        'vite-plugin-node-polyfills/shims/global',
        'vite-plugin-node-polyfills/shims/process',
      ],
      exclude: ['@midnight-ntwrk/ledger-v7'],
    },
  };
});
