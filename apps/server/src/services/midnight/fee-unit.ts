import {
  type LedgerParameters,
  Transaction,
  ZswapOffer,
  ZswapOutput,
  createShieldedCoinInfo,
  sampleCoinPublicKey,
  sampleEncryptionPublicKey,
  sampleRawTokenType,
} from '@midnightntwrk/ledger-v9';

const cache = new WeakMap<LedgerParameters, bigint>();

/**
 * The fee, under `params`, of a transaction holding a single shielded output. Offer fee
 * overheads are configured as multiples of this, so they follow fee prices as they change
 * rather than going stale.
 */
export function feeUnitSpecks(params: LedgerParameters, networkId: string): bigint {
  const cached = cache.get(params);
  if (cached !== undefined) {
    return cached;
  }
  const rawId = sampleRawTokenType();
  const coin = createShieldedCoinInfo(rawId, 1n);
  const output = ZswapOutput.new(coin, 0, sampleCoinPublicKey(), sampleEncryptionPublicKey());
  const tx = Transaction.fromParts(networkId, ZswapOffer.fromOutput(output, rawId, coin.value));
  const fee = tx.eraseProofs().fees(params);
  cache.set(params, fee);
  return fee;
}
