import { fileURLToPath } from 'url';
import * as path from 'path';
import type { Logger } from './index';

export type { Logger };

function extractTag(meta: ImportMeta): string {
  const filePath = fileURLToPath(meta.url);
  const srcIndex = filePath.indexOf('/src/');
  if (srcIndex !== -1) {
    const relativePath = filePath.slice(srcIndex + 5);
    return relativePath.replace(/\.ts$/, '').replace(/\//g, ':');
  }
  return path.basename(filePath, '.ts');
}

export function createLogger(meta: ImportMeta): Logger {
  const tag = extractTag(meta);

  return {
    debug: (...args: unknown[]) => {
      console.error(`[${tag}] DEBUG:`, ...args);
    },
    info: (...args: unknown[]) => {
      console.error(`[${tag}] INFO:`, ...args);
    },
    warn: (...args: unknown[]) => {
      console.error(`[${tag}] WARN:`, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(`[${tag}] ERROR:`, ...args);
    },
  };
}
