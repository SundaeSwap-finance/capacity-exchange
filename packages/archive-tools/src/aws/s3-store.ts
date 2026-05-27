import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { canonicalizeJson } from '../archive.js';

export interface S3StoreOpts {
  bucket: string;
  region?: string;
}

enum ContentType {
  Json = 'application/json',
  OctetStream = 'application/octet-stream',
}

/** Picks a Content-Type based on file extension. */
function contentTypeFor(filename: string): ContentType {
  return filename.endsWith('.json') ? ContentType.Json : ContentType.OctetStream;
}

/** Returns absolute paths of every file under rootDir (recursive). */
function walkFiles(rootDir: string): string[] {
  return readdirSync(rootDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

export class S3Store {
  private client: S3Client;
  private bucket: string;

  constructor(opts: S3StoreOpts) {
    this.client = new S3Client({ region: opts.region });
    this.bucket = opts.bucket;
  }

  /** Uploads one object. */
  async put(key: string, body: Buffer | string, contentType: ContentType): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      })
    );
  }

  /** Uploads a value serialized in canonical JSON form. */
  async putJson(key: string, value: unknown): Promise<void> {
    await this.put(key, canonicalizeJson(value), ContentType.Json);
  }

  /** Uploads every file under localDir in parallel under keyPrefix. Awaits all uploads before throwing on failure. */
  async putDir(keyPrefix: string, localDir: string): Promise<string[]> {
    const files = walkFiles(localDir);
    const results = await Promise.allSettled(
      files.map(async (absPath) => {
        const rel = relative(localDir, absPath);
        const key = `${keyPrefix}/${rel}`;
        await this.put(key, readFileSync(absPath), contentTypeFor(rel));
        return key;
      })
    );
    const failed = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];
    if (failed.length > 0) {
      throw new Error(`s3 putDir: ${failed.length}/${results.length} uploads failed; first: ${failed[0].reason}`);
    }
    return results.map((r) => (r as PromiseFulfilledResult<string>).value);
  }
}
