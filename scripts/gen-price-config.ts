#!/usr/bin/env bun
/**
 * Generates a CES price config file from contract deployment parameters.
 *
 * Usage:
 *   bun scripts/gen-price-config.ts <outFile> <tokenColor> <tokenMintAddress> \
 *     [--with-peer-max-prices] [--unshielded-token-color <color>]
 *
 * --with-peer-max-prices          Include a peer.maxPrices section (priceFormulas plus headroom for offer fees).
 *                                 Required for the no-dust server to enable DUST fallback via peers.
 * --unshielded-token-color <color> Also add an unshielded price formula for the given token color.
 */

import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const withPeerMaxPrices = args.includes('--with-peer-max-prices');
const unshieldedIdx = args.indexOf('--unshielded-token-color');
const unshieldedTokenColor = unshieldedIdx !== -1 ? args[unshieldedIdx + 1] : undefined;
const positional = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--unshielded-token-color');
const [outFile, tokenColor, tokenMintAddress] = positional;

if (!outFile || !tokenColor || !tokenMintAddress) {
  console.error(
    'Usage: gen-price-config.ts <outFile> <tokenColor> <tokenMintAddress>\n' +
      '  [--with-peer-max-prices] [--unshielded-token-color <color>]'
  );
  process.exit(1);
}

// About 1 token per trillion specks. Ledger v9 fees run to ~1e14 specks per tx, and the CI
// runner wallet only mints 1,000,000 tokens per run, so this keeps prices in the hundreds.
const RATE_DENOMINATOR = '1000000000000';

const shieldedFormula = {
  currency: { type: 'midnight:shielded', rawId: tokenColor },
  basePrice: '101',
  rateNumerator: '1',
  rateDenominator: RATE_DENOMINATOR,
};

const unshieldedFormula = {
  currency: { type: 'midnight:unshielded', rawId: unshieldedTokenColor },
  basePrice: '101',
  rateNumerator: '1',
  rateDenominator: RATE_DENOMINATOR,
};

const dustFormulas: unknown[] = [shieldedFormula];

// add unshielded formula if requested
if (unshieldedTokenColor) {
  dustFormulas.push(unshieldedFormula);
}

// Formulas are grouped by the capacity asset they price. This generator only wires up the
// Midnight demo, so it emits DUST formulas only.
const priceFormulas = { DUST: dustFormulas };

const config: Record<string, unknown> = {
  priceFormulas,
  sponsorAll: false,
  sponsoredContracts: [{ contractAddress: tokenMintAddress, circuits: { type: 'all' } }],
};

// A peer's quote covers the fees its offer adds on top of the DUST we ask for, while our cap
// is evaluated at the DUST we ask for alone. So the cap needs headroom for that overhead
// (~400–800 tokens at ledger v9 fees and the rate above); 10,000 leaves plenty.
const PEER_MAX_PRICE_HEADROOM = 10_000n;

if (withPeerMaxPrices) {
  const maxPriceFormulas = dustFormulas.map((formula) => {
    const { basePrice } = formula as { basePrice: string };
    return { ...(formula as object), basePrice: (BigInt(basePrice) + PEER_MAX_PRICE_HEADROOM).toString() };
  });
  config.peer = { maxPrices: { DUST: maxPriceFormulas } };
}

writeFileSync(outFile, JSON.stringify(config, null, 2) + '\n');
