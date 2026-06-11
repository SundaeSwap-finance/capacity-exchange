import { persistentHash } from '@midnight-ntwrk/ledger-v8';

/** Compact persistentHash<Bytes<32>> of a 32-byte value, off-chain. */
export function persistentHashBytes32(value: Uint8Array): Uint8Array {
  const alignment = [{ tag: 'atom' as const, value: { tag: 'bytes' as const, length: 32 } }];
  return persistentHash(alignment, [value])[0];
}
