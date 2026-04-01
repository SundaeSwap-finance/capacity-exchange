import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  if (!env.DASHBOARD_PORT) {
    throw new Error('DASHBOARD_PORT is not set. Copy .env.example to .env and configure it.');
  }
  return {
    plugins: [react()],
    server: {
      port: parseInt(env.DASHBOARD_PORT, 10),
    },
    build: {
      target: 'esnext',
    },
  };
});
