/* global process */
import fs from 'fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { loadWalletSeed, requireNodeEnv } from '@capacity-exchange/midnight-node';
import { uint8ArrayToHex } from '@capacity-exchange/midnight-core';

// https://vitejs.dev/config/
export default defineConfig(() => {
  const networkId = requireNodeEnv('NETWORK_ID');
  process.env.VITE_NETWORK_ID = networkId;
  process.env.VITE_CAPACITY_EXCHANGE_URL ??= `https://capacity-exchange.${networkId}.sundae.fi`;
  process.env.VITE_SERVER_SEED_HEX = uint8ArrayToHex(loadWalletSeed(networkId));
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
