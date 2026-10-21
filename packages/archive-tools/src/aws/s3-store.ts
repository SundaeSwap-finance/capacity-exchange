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

// A GetObject body can stall without erroring, and the SDK's retries end once the
// response headers arrive. So each read gets its own deadline and retries.
const GET_ATTEMPTS = 3;
const GET_TIMEOUT_MS = 60_000;

/** Runs `op` with an abort signal, rejecting if it hasn't settled within `ms`. */
async function withDeadline<T>(ms: number, what: string, op: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`${what} timed out after ${ms}ms`));
    }, ms);
  });
  try {
    return await Promise.race([op(controller.signal), deadline]);
  } finally {
    clearTimeout(timer);
  }
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
   * Retries a read that misses its deadline, body included.
   */
  private async get<T>(
    key: string,
    transform: (body: NonNullable<GetObjectCommandOutput['Body']>) => Promise<T>
  ): Promise<T | null> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await withDeadline(GET_TIMEOUT_MS, `s3 get '${key}'`, async (abortSignal) => {
          const res = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
            abortSignal,
          });
          return await transform(res.Body!);
        });
      } catch (err) {
        if (isAwsError(err, 'NoSuchKey')) {
          return null;
        }
        const timedOut = err instanceof Error && err.message.endsWith(`timed out after ${GET_TIMEOUT_MS}ms`);
        if (!timedOut || attempt >= GET_ATTEMPTS) {
          throw err;
        }
      }
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
