import { Currency } from '@sundaeswap/capacity-exchange-providers';

/** Well-known Midnight token colors. */
const KNOWN_TOKENS: Record<string, { label: string; className: string; decimals?: number }> = {
  // NIGHT — 64 hex zeros
  ['0'.repeat(64)]: { label: 'mNIGHT', className: 'text-ces-text', decimals: 6 },
  // Mainnet USDM bridged from Cardano mainnet
  '8c2c22bc0c37fa999d0611cb5c570f587938ac5ffc8b0925143dad4c0764e94b': {
    label: 'USDM',
    className: 'text-ces-text',
    decimals: 6,
  },
  // Preview USDM bridged from Cardano preprod
  '003bacd9a361ba0d425e408776020e40271375e8b8de42d73eec046a44947d73': {
    label: 'USDM',
    className: 'text-ces-text',
    decimals: 6,
  },
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
): { label: string; className: string; decimals: number; known: boolean } {
  if (mintedTokenColor && currency.type === 'midnight:shielded' && currency.rawId === mintedTokenColor) {
    return { label: 'Tutorial Tokens', className: 'text-ces-gold', decimals: 0, known: true };
  }

  const entry = KNOWN_TOKENS[currency.rawId];
  if (entry) {
    return { ...entry, decimals: entry.decimals ?? 0, known: true };
  }

  // Truncated hex fallback
  return {
    label: `${currency.rawId.slice(0, 8)}...${currency.rawId.slice(-6)}`,
    className: 'text-ces-text-muted',
    decimals: 0,
    known: false,
  };
}
