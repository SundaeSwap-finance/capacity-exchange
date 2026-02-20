import { spawn, ChildProcess } from 'child_process';
import { setTimeout } from 'timers/promises';
import { createWriteStream } from 'fs';
import path from 'path';

let serverProcess: ChildProcess | null = null;
const BASE_URL = 'http://localhost:3000';
const CWD = process.cwd();
const LOG_FILE = path.join(CWD, `${new Date().toISOString().replace(/:/g, '-')}_server.log`);

export async function setup() {
  if (serverProcess) {
    return;
  }

  console.log('Starting server');
  const logStream = createWriteStream(LOG_FILE, { flags: 'a' });
  serverProcess = spawn('bun', ['src/server.ts'], {
    stdio: 'pipe',
    env: {
      ...process.env,
      LOG_LEVEL: 'debug',
      // Speed-up expiry
      OFFER_TTL_SECONDS: '2',
    },
  });
  serverProcess.on('error', (err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
  serverProcess.stdout?.pipe(logStream);
  serverProcess.stderr?.pipe(logStream);

  // Wait for readiness
  const maxRetries = 60;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${BASE_URL}/health/ready`);
      if (res.status === 200) {
        console.log('Server is ready');
        return;
      }
    } catch (e) {
      // Ignore until max retries
    }
    await setTimeout(1000);
  }
  throw new Error('Server timed out waiting for readiness');
}

export async function teardown() {
  if (serverProcess) {
    console.log('Stopping server');
    serverProcess.kill();
    serverProcess = null;
  }
}
