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

/** Git tag preserving the source commit: `archive/<sha>`. */
export function archiveTag(args: { sha: string }): string {
  return `${ARCHIVE_PREFIX}/${args.sha}`;
}

/** Blob-store prefix for one contract's archive: `archive/<sha>/<contract>`. */
export function archiveKeyPrefix(args: { sha: string; contract: string }): string {
  return `${archiveTag(args)}/${args.contract}`;
}

/** Blob-store key for the contract's provenance file. */
export function archiveProvenanceKey(args: { sha: string; contract: string }): string {
  return `${archiveKeyPrefix(args)}/${PROVENANCE_FILE}`;
}

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
