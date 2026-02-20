import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { contractsApiPlugin } from './server/index';

// Proxy indexer HTTP endpoints to avoid CORS. WebSocket and proof server
// connections don't need proxying.
const INDEXER_TARGETS = {
  undeployed: 'http://localhost:8088',
  preview: 'https://indexer.preview.midnight.network',
  preprod: 'https://indexer.preprod.midnight.network',
  testnet: 'https://indexer.testnet.midnight.network',
  mainnet: 'https://indexer.mainnet.midnight.network',
};

function buildProxyConfig() {
  const proxy = {};
  for (const [id, target] of Object.entries(INDEXER_TARGETS)) {
    proxy[`/proxy/${id}/indexer`] = {
      target,
      changeOrigin: true,
      rewrite: (path) => path.replace(new RegExp(`^/proxy/${id}/indexer`), ''),
    };
  }
  return proxy;
}

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    global: 'globalThis',
  },
  plugins: [
    react(),
    basicSsl(),
    wasm(),
    nodePolyfills({
      include: ['process', 'buffer', 'crypto', 'stream', 'events', 'assert'],
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
    }),
    contractsApiPlugin(),
  ],
  build: {
    target: 'esnext',
  },
  server: {
    watch: {
      include: ['../components/src/**/*.{js,ts,jsx,tsx}'],
    },
    proxy: buildProxyConfig(),
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/ledger-v7'],
  },
});
