import fs from 'node:fs';
import path from 'node:path';

export function readFileOrError(filePath: string, errorPrefix: string): string {
  try {
    return fs.readFileSync(path.resolve(process.cwd(), filePath), 'utf-8');
  } catch (err) {
    throw new Error(`${errorPrefix} ${filePath}: ${err instanceof Error ? err.message : err}`);
  }
}
