import { readFileSync, readdirSync } from 'fs';
import { join, relative } from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

export interface S3StoreOpts {
  bucket: string;
  region?: string;
}

/** Picks a Content-Type based on file extension. Internal helper for putDir. */
function contentTypeFor(filename: string): string {
  return filename.endsWith('.json') ? 'application/json' : 'application/octet-stream';
}

/** Returns absolute paths of every file under rootDir (recursive). */
function walkFiles(rootDir: string): string[] {
  return readdirSync(rootDir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

/** True if `err` is an AWS SDK error whose `name` matches one of the given sentinels. */
function isAwsError(err: unknown, ...names: string[]): boolean {
  const n = (err as { name?: string }).name;
  return n !== undefined && names.includes(n);
}

export class S3Store {
  private client: S3Client;
  private bucket: string;

  constructor(opts: S3StoreOpts) {
    this.client = new S3Client({ region: opts.region });
    this.bucket = opts.bucket;
  }

  /** Uploads one object. */
  async put(key: string, body: Buffer | string, contentType: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType })
    );
  }

  /**
   * Conditionally uploads only if the key does not exist. Returns 'written' on success and
   * 'exists' if S3 reports the object already present. Atomic on the S3 side.
   */
  async putIfAbsent(key: string, body: Buffer | string, contentType: string): Promise<'written' | 'exists'> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          IfNoneMatch: '*',
        })
      );
      return 'written';
    } catch (err) {
      if (isAwsError(err, 'PreconditionFailed')) {
        return 'exists';
      }
      throw err;
    }
  }

  /** Reads the object as a string. Returns null if the key does not exist. */
  async get(key: string): Promise<string | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return await res.Body!.transformToString();
    } catch (err) {
      if (isAwsError(err, 'NoSuchKey')) {
        return null;
      }
      throw err;
    }
  }

  /** Returns true if the object exists. One round-trip, no body fetch. */
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch (err) {
      if (isAwsError(err, 'NotFound', 'NoSuchKey')) {
        return false;
      }
      throw err;
    }
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
