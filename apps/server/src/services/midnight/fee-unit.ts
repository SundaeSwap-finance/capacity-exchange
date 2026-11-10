import { type LedgerParameters, Transaction } from '@midnightntwrk/ledger-v9';

/**
 * A proof-erased transaction holding a single shielded output (to a fixed key, for a fixed
 * coin). It's embedded rather than built on the fly because the ledger randomises
 * commitments, which makes a freshly built tx's size, and so its fee, vary by a byte.
 */
const REFERENCE_TX_HEX =
  '6d69646e696768743a7472616e73616374696f6e5b7631325d287369676e61747572655b76325d2c28292c706564657273656e5b76315d293a200099037983d3f22764256f44518fd2640080400b6becda486e11c4913c8622a3e86ded73048f92b3daea7bda3f6c78716e426295bf18376c1ee9ca2b93f2d8efac04984b73685d1190585e5427021fd469090edb18a707f36bd693587501d9488103f4ea1273c03072a5b0fc1cac3929928e5e3d8865747a1f14b71d11f493ec27e9bb943d627333c9c9b7d9af0c3dabf8171a76c9d9693e053d72adc592b627a733e93ccedb1b73f340ac24127aee586d87932e8d9d2da3230e30619e649005f01c650f7275325b737f024a1660e57ccedef0c3fe088b03de14bb9c5c7b8102734820a087c4e17b6e04000901092bd7b5a9f85aacbbab0aa7236ede49bc097a091ebccf5d6e42c6caddfecd039bb7e43a4e775c35039e65066aa2ce38d0792a15e08ba9b40628e862a2ae72e20100040408010400040000c00000000000000000000000000000000000000000000000000000000000000000ffffffffffffffffffffffffffffffff0410080104100c080c14000c0c180cb80028756e6465706c6f79656400736e1cb8ed740c290e602a8c69b863ab89423a02677542d805dd90b6d77a023601';

const referenceTx = Transaction.deserialize(
  'signature',
  'no-proof',
  'no-binding',
  Buffer.from(REFERENCE_TX_HEX, 'hex'),
);

/**
 * The fee, under `params`, of a transaction holding a single shielded output. Offer fee
 * overheads are configured as multiples of this, so they follow fee prices as they change
 * rather than going stale.
 */
export function feeUnitSpecks(params: LedgerParameters): bigint {
  return referenceTx.fees(params);
}
