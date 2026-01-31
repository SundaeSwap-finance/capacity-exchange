import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

// https://vitejs.dev/config/
export default defineConfig({
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
      include: ['../components/src/**/*.{js,ts,jsx,tsx}'],
    },
    // Dev server proxies to avoid CORS issues with Midnight network services.
    // Requests to /proxy/* are forwarded to the target, with the /proxy/* prefix stripped.
    // This allows the app to use relative URLs (e.g., /proxy/preview-indexer/api/v3/graphql)
    // which work in dev (proxied) and can be configured differently in production.
    proxy: {
      '/proxy/preview-indexer': {
        target: 'https://indexer.preview.midnight.network',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/preview-indexer/, ''),
      },
      '/proxy/preview-prover': {
        target: 'https://lace-proof-pub.preview.midnight.network',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/preview-prover/, ''),
      },
    },
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/ledger-v6'],
  },
});
