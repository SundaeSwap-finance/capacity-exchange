#!/usr/bin/env bun
/**
 * Generates a CES price config file from contract deployment parameters.
 *
 * Usage:
 *   bun scripts/gen-price-config.ts <outFile> <tokenColor> <tokenMintAddress>
 */

import { writeFileSync } from 'fs';

const [outFile, tokenColor, tokenMintAddress] = process.argv.slice(2);
if (!outFile || !tokenColor || !tokenMintAddress) {
  console.error('Usage: gen-price-config.ts <outFile> <tokenColor> <tokenMintAddress>');
  process.exit(1);
}

writeFileSync(
  outFile,
  `{
  "priceFormulas": [
    {
      "currency": {
        "type": "midnight:shielded",
        "rawId": "${tokenColor}"
      },
      "basePrice": "101",
      "rateNumerator": "11",
      "rateDenominator": "1000"
    }
  ],
  "sponsorAll": false,
  "sponsoredContracts": [
    {
      "contractAddress": "${tokenMintAddress}",
      "circuits": { "type": "all" }
    }
  ]
}
`
);
