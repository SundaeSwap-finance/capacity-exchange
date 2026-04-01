/* global process */
import fs from 'fs';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { loadWalletSeed } from '@capacity-exchange/midnight-node';
import { uint8ArrayToHex } from '@capacity-exchange/midnight-core';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const networkId = process.env.NETWORK_ID ?? process.env.VITE_NETWORK_ID ?? env.NETWORK_ID ?? env.VITE_NETWORK_ID;
  if (!networkId) {
    throw new Error(
      'Missing network configuration. Set NETWORK_ID in your shell or in packages/example-webapp/.env (for example NETWORK_ID=preview).',
    );
  }
  process.env.VITE_NETWORK_ID = networkId;
  process.env.VITE_CAPACITY_EXCHANGE_URL ??= `https://capacity-exchange.${networkId}.sundae.fi`;
  if (!process.env.VITE_SERVER_SEED_HEX) {
    try {
      process.env.VITE_SERVER_SEED_HEX = uint8ArrayToHex(loadWalletSeed(networkId));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[example-webapp] Server wallet disabled: ${message}`);
    }
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
