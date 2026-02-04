import type { SeedValidation } from './types';

/**
 * Validates a wallet seed.
 *
 * A valid seed is a 64-character hexadecimal string (32 bytes).
 */
export function validateSeed(seed: string): SeedValidation {
  const trimmed = seed.trim();

  if (trimmed.length !== 64) {
    return {
      isValid: false,
      error: `Seed must be 64 characters (got ${trimmed.length})`,
    };
  }

  if (!/^[0-9a-fA-F]+$/.test(trimmed)) {
    return {
      isValid: false,
      error: 'Seed must contain only hexadecimal characters (0-9, a-f)',
    };
  }

  return { isValid: true };
}
