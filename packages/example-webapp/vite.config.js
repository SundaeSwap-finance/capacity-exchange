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
  },
  optimizeDeps: {
    exclude: ['@midnight-ntwrk/ledger-v6'],
  },
});
