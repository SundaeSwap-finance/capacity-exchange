/** Move bytes between S3 and the local filesystem, on top of `S3Store`. */

import { mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { dirname, join, relative } from 'path';
import { S3Store } from './s3-store.js';
import { contentTypeFor, parallelAllOrThrow, walkFiles } from '../util.js';

/** Fetches one key as raw bytes into a local path. Creates parent directories. Throws if absent. */
export async function downloadKey(store: S3Store, key: string, localPath: string): Promise<void> {
  const body = await store.getBytes(key);
  if (body === null) {
    throw new Error(`s3 downloadKey: key '${key}' not found in bucket '${store.bucket}'`);
  }
  mkdirSync(dirname(localPath), { recursive: true });
  await writeFile(localPath, body);
}

/** Uploads one local file under the given key. Content-Type is inferred from the file's extension. */
export async function uploadFile(store: S3Store, absPath: string, key: string): Promise<void> {
  await store.put(key, await readFile(absPath), contentTypeFor(absPath));
}

/**
 * Lists keys under keyPrefix and downloads each to localDir, preserving the suffix
 * after keyPrefix as the local relative path. Returns the downloaded keys.
 */
export async function downloadPrefix(store: S3Store, keyPrefix: string, localDir: string): Promise<string[]> {
  const prefix = keyPrefix.endsWith('/') ? keyPrefix : `${keyPrefix}/`;
  const keys = (await store.listKeysUnder(prefix)).filter((key) => {
    const suffix = key.slice(prefix.length);
    return suffix !== '' && !suffix.endsWith('/');
  });
  await parallelAllOrThrow(
    keys,
    (key) => downloadKey(store, key, join(localDir, key.slice(prefix.length))),
    `s3 downloadPrefix s3://${store.bucket}/${keyPrefix}`
  );
  return keys;
}

/** Uploads every file under localDir in parallel under keyPrefix. Returns the keys written. */
export async function uploadDir(store: S3Store, keyPrefix: string, localDir: string): Promise<string[]> {
  const files = walkFiles(localDir);
  return parallelAllOrThrow(
    files,
    async (absPath) => {
      const key = `${keyPrefix}/${relative(localDir, absPath)}`;
      await uploadFile(store, absPath, key);
      return key;
    },
    `s3 uploadDir s3://${store.bucket}/${keyPrefix}`
  );
}
