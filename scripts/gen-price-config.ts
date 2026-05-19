#!/usr/bin/env bun
/**
 * Generates a CES price config file from contract deployment parameters.
 *
 * Usage:
 *   bun scripts/gen-price-config.ts <outFile> <tokenColor> <tokenMintAddress>
 */

import { writePriceConfig } from './lib/price-config.ts';

const [outFile, tokenColor, tokenMintAddress] = process.argv.slice(2);
if (!outFile || !tokenColor || !tokenMintAddress) {
  console.error('Usage: gen-price-config.ts <outFile> <tokenColor> <tokenMintAddress>');
  process.exit(1);
}

writePriceConfig(outFile, tokenColor, tokenMintAddress);
