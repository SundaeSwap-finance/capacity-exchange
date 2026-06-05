#!/usr/bin/env bun
/**
 * Generates a CES price config file from contract deployment parameters.
 *
 * Usage:
 *   bun scripts/gen-price-config.ts <outFile> <shieldedTokenColor> <unshieldedTokenColor> \
 *     <tokenMintAddress> [--with-peer-max-prices]
 *
 * --with-peer-max-prices  Include a peer.maxPrices section (same values as priceFormulas).
 *                         Required for the no-dust server to enable DUST fallback via peers.
 */

import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const withPeerMaxPrices = args.includes('--with-peer-max-prices');
const [outFile, shieldedTokenColor, unshieldedTokenColor, tokenMintAddress] = args.filter((a) => !a.startsWith('--'));

if (!outFile || !shieldedTokenColor || !unshieldedTokenColor || !tokenMintAddress) {
  console.error(
    'Usage: gen-price-config.ts <outFile> <shieldedTokenColor> <unshieldedTokenColor>\n' +
      '  <tokenMintAddress> [--with-peer-max-prices]'
  );
  process.exit(1);
}

const shieldedPriceFormula = {
  currency: { type: 'midnight:shielded', rawId: shieldedTokenColor },
  basePrice: '101',
  rateNumerator: '11',
  rateDenominator: '1000',
};

const unshieldedPriceFormula = {
  currency: { type: 'midnight:unshielded', rawId: unshieldedTokenColor },
  basePrice: '101',
  rateNumerator: '11',
  rateDenominator: '1000',
};

const priceFormulas = [shieldedPriceFormula, unshieldedPriceFormula];

const config: Record<string, unknown> = {
  priceFormulas,
  sponsorAll: false,
  sponsoredContracts: [{ contractAddress: tokenMintAddress, circuits: { type: 'all' } }],
};

if (withPeerMaxPrices) {
  config.peer = { maxPrices: priceFormulas };
}

writeFileSync(outFile, JSON.stringify(config, null, 2) + '\n');
