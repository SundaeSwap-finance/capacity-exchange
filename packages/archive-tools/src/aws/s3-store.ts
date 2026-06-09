import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

export interface S3StoreOpts {
  bucket: string;
  region?: string;
}

/** True if `err` is an AWS SDK error whose `name` matches one of the given sentinels. */
function isAwsError(err: unknown, ...names: string[]): boolean {
  const n = (err as { name?: string }).name;
  return n !== undefined && names.includes(n);
}

/** Thin wrapper around `S3Client` with the bucket name baked in. Pure S3 IO; no fs. */
export class S3Store {
  private client: S3Client;
  readonly bucket: string;

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

  /**
   * GetObject with a caller-supplied body transformer. Returns null when the key is
   * absent, propagates any other SDK error. All single-key reads route through here.
   */
  private async get<T>(
    key: string,
    transform: (body: NonNullable<GetObjectCommandOutput['Body']>) => Promise<T>
  ): Promise<T | null> {
    try {
      const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
      return await transform(res.Body!);
    } catch (err) {
      if (isAwsError(err, 'NoSuchKey')) {
        return null;
      }
      throw err;
    }
  }

  /** Reads the object as a string (UTF-8). Returns null if the key does not exist. */
  async getString(key: string): Promise<string | null> {
    return this.get(key, (body) => body.transformToString());
  }

  /** Reads the object as raw bytes. Returns null if missing. Use for binary keys (.prover, .verifier, etc). */
  async getBytes(key: string): Promise<Buffer | null> {
    return this.get(key, async (body) => Buffer.from(await body.transformToByteArray()));
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

  /** Lists every key under prefix, paginating ListObjectsV2 transparently. */
  async listKeysUnder(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    let continuationToken: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: continuationToken })
      );
      for (const obj of page.Contents ?? []) {
        if (obj.Key) {
          keys.push(obj.Key);
        }
      }
      continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (continuationToken);
    return keys;
  }
}
