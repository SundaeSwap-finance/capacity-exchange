import type { DustGenerationRates } from '@midnight-ntwrk/wallet-sdk/dust';

// Dust wallet parameters from spec:
// https://github.com/midnightntwrk/midnight-ledger/blob/main/spec/dust.md#initial-dust-parameters
export const DUST_PARAMS: DustGenerationRates = {
  nightDustRatio: 5_000_000_000n,
  generationDecayRate: 8_267n,
  dustGracePeriodSeconds: 3n * 60n * 60n,
};

// Cost parameters for fee estimation
export const COST_PARAMS = {
  additionalFeeOverhead: 50_000_000_000_000n,
  feeBlocksMargin: 0,
} as const;
