import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const PROVENANCE_FILE = 'provenance.json';
const ARCHIVE_PREFIX = 'archive';

export const PROVENANCE_FIELDS = ['sourceSha', 'sourceFile', 'sourceRepo'] as const;

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

/** Reads a JSON file and asserts every required field is defined. */
function loadJsonWithFields<T>(path: string, requiredFields: readonly (keyof T)[]): T {
  const value = JSON.parse(readFileSync(path, 'utf-8')) as T;
  for (const field of requiredFields) {
    if ((value as Record<string, unknown>)[field as string] === undefined) {
      throw new Error(`${path} missing field '${String(field)}'`);
    }
  }
  return value;
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

/** On-disk path to the provenance file inside a contract's archive directory. */
function provenancePath(contractDir: string): string {
  return join(contractDir, PROVENANCE_FILE);
}

/** Loads + validates a contract's provenance file. */
export function loadProvenance(contractDir: string): Provenance {
  return loadJsonWithFields<Provenance>(provenancePath(contractDir), PROVENANCE_FIELDS);
}

/** Writes a contract's provenance file in canonical form. Returns the path written. */
export function writeProvenance(contractDir: string, provenance: Provenance): string {
  const path = provenancePath(contractDir);
  writeFileSync(path, canonicalizeJson(provenance));
  return path;
}
