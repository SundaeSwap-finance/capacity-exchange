import { fileURLToPath } from 'url';
import * as path from 'path';

export interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

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
    log: (...args: unknown[]) => {
      console.error(`[${tag}]`, ...args);
    },
    warn: (...args: unknown[]) => {
      console.error(`[${tag}] WARN:`, ...args);
    },
    error: (...args: unknown[]) => {
      console.error(`[${tag}] ERROR:`, ...args);
    },
  };
}
