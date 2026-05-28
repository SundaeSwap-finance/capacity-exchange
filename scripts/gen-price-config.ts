#!/usr/bin/env bun
/**
 * Generates a CES price config file from contract deployment parameters.
 *
 * Usage:
 *   bun scripts/gen-price-config.ts <outFile> <tokenColor> <tokenMintAddress> [--with-peer-max-prices]
 *
 * --with-peer-max-prices  Include a peer.maxPrices section (same values as priceFormulas).
 *                         Required for the no-dust server to enable DUST fallback via peers.
 */

import { writeFileSync } from 'fs';

const args = process.argv.slice(2);
const withPeerMaxPrices = args.includes('--with-peer-max-prices');
const [outFile, tokenColor, tokenMintAddress] = args.filter((a) => !a.startsWith('--'));

if (!outFile || !tokenColor || !tokenMintAddress) {
  console.error('Usage: gen-price-config.ts <outFile> <tokenColor> <tokenMintAddress> [--with-peer-max-prices]');
  process.exit(1);
}

const priceFormula = {
  currency: { type: 'midnight:shielded', rawId: tokenColor },
  basePrice: '101',
  rateNumerator: '11',
  rateDenominator: '1000',
};

const config: Record<string, unknown> = {
  priceFormulas: [priceFormula],
  sponsorAll: false,
  sponsoredContracts: [{ contractAddress: tokenMintAddress, circuits: { type: 'all' } }],
};

if (withPeerMaxPrices) {
  config.peer = { maxPrices: [priceFormula] };
}

writeFileSync(outFile, JSON.stringify(config, null, 2) + '\n');
