const PROVENANCE_FILE = 'provenance.json';
const ARCHIVE_PREFIX = 'archive';

/**
 * Subdirectories of a contract's archive prefix that hold the compactc compile output.
 * Used by readers that pull compile output (but not provenance or deploy records) into
 * a local out/ dir. The full S3 key for one subdir is `${archiveKey.prefix(...)}/${sub}`.
 */
export const COMPILE_OUTPUT_SUBDIRS = ['contract', 'keys', 'zkir', 'compiler'] as const;

/** Provenance fields needed to fully reproduce the archive from a bare s3 copy. */
export interface Provenance {
  sourceSha: string;
  sourceFile: string;
  sourceRepo: string;
}

/** Byte-stable JSON serialization used everywhere we persist JSON. */
export function canonicalizeJson(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Encoder pair (body, content-type) for JSON writes to a byte-store like S3Store. */
export function asJson(value: unknown): [string, string] {
  return [canonicalizeJson(value), 'application/json'];
}

/** Decoder for raw byte-store reads. Returns null when the source is null (i.e. key absent). */
export function fromJson<T>(raw: string | null): T | null {
  return raw === null ? null : (JSON.parse(raw) as T);
}

/** S3 keys (and the git tag) under the `archive/` prefix. */
export const archiveKey = {
  tag: ({ sha }: { sha: string }) => `${ARCHIVE_PREFIX}/${sha}`,
  prefix: ({ sha, contract }: { sha: string; contract: string }) => `${archiveKey.tag({ sha })}/${contract}`,
  provenance: ({ sha, contract }: { sha: string; contract: string }) =>
    `${archiveKey.prefix({ sha, contract })}/${PROVENANCE_FILE}`,
  deploy: ({ sha, contract, address }: { sha: string; contract: string; address: string }) =>
    `${archiveKey.prefix({ sha, contract })}/deploys/${address}.json`,
};
