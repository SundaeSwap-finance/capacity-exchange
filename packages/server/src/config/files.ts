import fs from 'node:fs/promises';
import path from 'node:path';

export async function readFileOrError(filePath: string, errorPrefix: string): Promise<string> {
  try {
    return await fs.readFile(path.resolve(process.cwd(), filePath), 'utf-8');
  } catch (err) {
    throw new Error(`${errorPrefix} ${filePath}: ${err instanceof Error ? err.message : err}`);
  }
}
