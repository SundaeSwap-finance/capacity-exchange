import * as fs from 'fs';
import * as path from 'path';

export function readSeedHex(seedFile: string): string {
  return fs.readFileSync(path.resolve(process.cwd(), seedFile), 'utf-8').trim();
}

export function readSeed(seedFile: string): Buffer {
  return Buffer.from(readSeedHex(seedFile), 'hex');
}
