import { writeFileSync } from 'fs';

export interface GeneratedPriceConfig {
  priceFormulas: Array<{
    currency: { type: 'midnight:shielded'; rawId: string };
    basePrice: string;
    rateNumerator: string;
    rateDenominator: string;
  }>;
  sponsorAll: boolean;
  sponsoredContracts: Array<{
    contractAddress: string;
    circuits: { type: 'all' };
  }>;
}

export function buildPriceConfig(tokenColor: string, tokenMintAddress: string): GeneratedPriceConfig {
  return {
    priceFormulas: [
      {
        currency: { type: 'midnight:shielded', rawId: tokenColor },
        basePrice: '101',
        rateNumerator: '11',
        rateDenominator: '1000',
      },
    ],
    sponsorAll: false,
    sponsoredContracts: [{ contractAddress: tokenMintAddress, circuits: { type: 'all' } }],
  };
}

export function writePriceConfig(outPath: string, tokenColor: string, tokenMintAddress: string): void {
  writeFileSync(outPath, JSON.stringify(buildPriceConfig(tokenColor, tokenMintAddress), null, 2));
}
