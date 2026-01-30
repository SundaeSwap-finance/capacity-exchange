import * as fs from 'fs';
import * as path from 'path';
import { requireEnv } from './env.js';

export function readSeedHex(): string {
  const seedFile = requireEnv('WALLET_SEED_FILE');
  return fs.readFileSync(path.resolve(process.cwd(), seedFile), 'utf-8').trim();
}

export function readSeed(): Buffer {
  return Buffer.from(readSeedHex(), 'hex');
}
