import { readFileSync } from 'fs';

/** Contracts whose archived compile the monorepo pins. Every env runs the pinned compile. */
export const PINNED_CONTRACTS = ['counter', 'token-mint', 'registry'] as const;

export type PinnedContract = (typeof PINNED_CONTRACTS)[number];

/** Archived compile sha per contract, as pinned in the monorepo's contract-compiles.json. */
export type ContractCompiles = Record<PinnedContract, string>;

const SHA = /^[0-9a-f]{40}$/;

/** Validates a parsed pin file. `source` names it in errors. Pure. */
export function parseContractCompiles(raw: unknown, source: string): ContractCompiles {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`${source}: must be a JSON object`);
  }
  const fields = raw as Record<string, unknown>;
  const unknownKeys = Object.keys(fields).filter((key) => !(PINNED_CONTRACTS as readonly string[]).includes(key));
  if (unknownKeys.length > 0) {
    throw new Error(`${source}: unknown contracts ${unknownKeys.join(', ')}`);
  }
  for (const contract of PINNED_CONTRACTS) {
    const sha = fields[contract];
    if (typeof sha !== 'string' || !SHA.test(sha)) {
      throw new Error(`${source}: '${contract}' must be a full 40-character git sha, got ${JSON.stringify(sha)}`);
    }
  }
  return fields as ContractCompiles;
}

/** Reads and validates a pin file from disk. */
export function readContractCompiles(path: string): ContractCompiles {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    throw new Error(`${path}: ${(err as NodeJS.ErrnoException).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`${path}: not valid JSON (${(err as Error).message})`);
  }
  return parseContractCompiles(parsed, path);
}
