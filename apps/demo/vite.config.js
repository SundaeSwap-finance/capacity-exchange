/* global process, console */
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { loadWalletSeed, requireNodeEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  Object.assign(process.env, loadEnv(mode, process.cwd(), ''));
  const networkId = requireNodeEnv('NETWORK_ID');
  process.env.VITE_NETWORK_ID = networkId;
  process.env.VITE_CAPACITY_EXCHANGE_URL ??=
    networkId === 'mainnet'
      ? 'https://capacity-exchange.sundae.fi'
      : `https://capacity-exchange.${networkId}.sundae.fi`;
  try {
    process.env.VITE_SERVER_SEED_HEX = uint8ArrayToHex(loadWalletSeed(networkId));
  } catch {
    console.warn('No wallet seed found — server wallet (faucet) will be unavailable');
  }
  return {
    define: {
      global: 'globalThis',
    },
    resolve: {
      dedupe: ['effect'],
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
