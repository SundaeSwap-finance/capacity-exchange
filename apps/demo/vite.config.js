/* global process */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { requireEnvVar } from '@sundaeswap/capacity-exchange-nodejs';
import { fillAppConfig } from './scripts/fill-app-config';

// A build keeps index.html's placeholder, so one bundle serves every network and
// scripts/interpolate-index.ts fills it at deploy. The dev server fills it from the
// env, where the URL overrides and mock mode are honoured too.
function devAppConfig() {
  return {
    name: 'dev-app-config',
    apply: 'serve',
    transformIndexHtml(html) {
      const { CAPACITY_EXCHANGE_URL, PROOF_SERVER_URL, MOCK_DEMO_MODE } = process.env;
      return fillAppConfig(html, {
        networkId: requireEnvVar(process.env, 'NETWORK_ID'),
        ...(CAPACITY_EXCHANGE_URL && { capacityExchangeUrl: CAPACITY_EXCHANGE_URL }),
        ...(PROOF_SERVER_URL && { proofServerUrl: PROOF_SERVER_URL }),
        ...(MOCK_DEMO_MODE === 'true' && { mockDemo: true }),
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  return {
    define: {
      global: 'globalThis',
    },
    resolve: {
      dedupe: ['effect'],
    },
    plugins: [
      devAppConfig(),
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
