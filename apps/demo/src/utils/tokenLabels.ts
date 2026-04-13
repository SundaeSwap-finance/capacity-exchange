import { Currency } from '@sundaeswap/capacity-exchange-providers';

/** Well-known Midnight token colors. */
const KNOWN_TOKENS: Record<string, { label: string; className: string }> = {
  // NIGHT — 64 hex zeros
  ['0'.repeat(64)]: { label: 'mNIGHT', className: 'text-ces-text' },
};

/**
 * Resolve a human-readable label and optional CSS class for a token color hex.
 *
 * Priority:
 *  1. Matches the minted tutorial token → "Tutorial Tokens" (gold)
 *  2. Matches a well-known Midnight token → e.g. "mNIGHT"
 *  3. Falls back to truncated hex
 */
export function resolveTokenLabel(
  currency: Currency,
  mintedTokenColor: string | null
): { label: string; className: string } {
  if (mintedTokenColor && currency.type === 'midnight:shielded' && currency.rawId === mintedTokenColor) {
    return { label: 'Tutorial Tokens', className: 'text-ces-gold' };
  }

  const known = KNOWN_TOKENS[currency.rawId];
  if (known) {
    return known;
  }

  // Truncated hex fallback
  return {
    label: `${currency.rawId.slice(0, 8)}...${currency.rawId.slice(-6)}`,
    className: 'text-ces-text-muted',
  };
}
