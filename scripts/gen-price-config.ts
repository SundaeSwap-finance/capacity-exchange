#!/usr/bin/env bun
/**
 * Generates a CES price config file from contract deployment parameters.
 *
 * Usage:
 *   bun scripts/gen-price-config.ts <outFile> <tokenColor> <tokenMintAddress> [--with-peer-max-prices] [--unshielded-token-color <color>]
 *
 * --with-peer-max-prices          Include a peer.maxPrices section (same values as priceFormulas).
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
    'Usage: gen-price-config.ts <outFile> <tokenColor> <tokenMintAddress> [--with-peer-max-prices] [--unshielded-token-color <color>]'
  );
  process.exit(1);
}

const shieldedFormula = {
  currency: { type: 'midnight:shielded', rawId: tokenColor },
  basePrice: '101',
  rateNumerator: '11',
  rateDenominator: '1000',
};

const unshieldedFormula = {
  currency: { type: 'midnight:unshielded', rawId: unshieldedTokenColor },
  basePrice: '101',
  rateNumerator: '11',
  rateDenominator: '1000',
};

const priceFormulas: unknown[] = [shieldedFormula];

// add unshielded formula if requested
if (unshieldedTokenColor) {
  priceFormulas.push(unshieldedFormula);
}

const config: Record<string, unknown> = {
  priceFormulas,
  sponsorAll: false,
  sponsoredContracts: [{ contractAddress: tokenMintAddress, circuits: { type: 'all' } }],
};

if (withPeerMaxPrices) {
  config.peer = { maxPrices: priceFormulas };
}

writeFileSync(outFile, JSON.stringify(config, null, 2) + '\n');
