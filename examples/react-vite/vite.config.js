import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    nodePolyfills({
      include: ['process', 'crypto', 'stream'],
      globals: {
        process: true,
      },
    }),
  ],
  resolve: {
    conditions: ['browser', 'bun'],
  }
});
