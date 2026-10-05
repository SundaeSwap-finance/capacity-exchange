import type { CardanoCli, ProtocolParams, Utxo } from '../cardano/cli.js';
import { utxoRef } from '../cardano/cli.js';
import {
  addValue,
  assembleBatch,
  type AssembleResult,
  assertRoundTrip,
  decodeTx,
  readEnvelope,
  sumValues,
  type TxInput,
  type Value,
  type VerifiedOffer,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import { unitToCliAsset } from '../cardano/value.js';

/**
 * The stand-in exchange: what a service does behind `POST /offers`, run locally so the offer
 * flow can be followed without a server. Each function is one stage of CIP-0198's offer
 * lifecycle, and refuses with one of its rejection codes.
 */

export {
  receiveOffer,
  type ReceivedOffer,
  type QuoteTerms,
  verifyOffer,
  type VerifiedOffer,
} from '@sundaeswap/capacity-exchange-cardano-tx';

/**
 * The exchange's UTxO with the most lovelace: the most room for what a batch gives away. It is
 * paid in tokens, so its UTxOs carry them; whatever this one holds rides along into the change.
 */
export function selectFunding(utxos: Utxo[], address: string): Utxo {
  if (utxos.length === 0) {
    throw new Error(`Simulated exchange wallet ${address} has no UTxO to fund a batch with`);
  }
  return utxos.reduce((a, b) => (b.value.lovelace > a.value.lovelace ? b : a));
}

export interface BuildBatchParams {
  cli: CardanoCli;
  offers: VerifiedOffer[];
  funding: Utxo;
  address: string;
  pp: ProtocolParams;
  resolve: (input: TxInput) => Value;
  /** Where `build-raw` writes the exchange's own draft. */
  draftPath: string;
}

export interface BuiltBatch extends AssembleResult {
  /** The lovelace every offer needed, which the exchange gave up. */
  released: bigint;
  /** Tokens the exchange took in, summed over the offers. */
  earned: Value;
  /** Batch cost beyond the offers' own fee shares, carried by the exchange. */
  overhead: bigint;
}

/**
 * Builds the batch around verified offers. `cardano-cli build-raw` makes the exchange's own
 * part — its funding input and a change output that absorbs the offers' tokens — and the
 * offers are then spliced in verbatim, since `build-raw` has no way to carry them.
 */
export function buildBatch(params: BuildBatchParams): BuiltBatch {
  const { cli, offers, funding, address, pp, resolve, draftPath } = params;

  const released = offers.reduce((total, o) => total + o.lovelaceNeeded, 0n);
  const earned = sumValues(offers.map((o) => ({ lovelace: 0n, assets: o.offered })));
  const changeLovelace = funding.value.lovelace - released;
  if (changeLovelace <= 0n) {
    throw new Error(`Funding UTxO ${utxoRef(funding)} is too small to release ${released} lovelace`);
  }

  // No shell is involved, so the multi-asset part carries no quotes of its own.
  // The change keeps whatever tokens the funding UTxO already held, plus what the offers pay.
  const changeAssets = addValue({ lovelace: 0n, assets: funding.value.assets }, earned);
  const assets = [...changeAssets.assets].map(([unit, qty]) => `+${qty} ${unitToCliAsset(unit)}`).join('');
  cli.buildRaw([
    '--tx-in',
    utxoRef(funding),
    '--tx-out',
    `${address}+${changeLovelace}${assets}`,
    '--fee',
    '0',
    '--out-file',
    draftPath,
  ]);
  const envelope = readEnvelope(draftPath);
  assertRoundTrip(envelope.cborHex);

  const result = assembleBatch({
    draft: decodeTx(envelope.cborHex),
    changeIndex: 0,
    subs: offers.map((o) => o.sub),
    resolve,
    txFeeFixed: pp.txFeeFixed,
    txFeePerByte: pp.txFeePerByte,
    utxoCostPerByte: pp.utxoCostPerByte,
    witnessCount: 1,
  });

  const shares = offers.reduce((total, o) => total + o.feeShare, 0n);
  return { ...result, released, earned, overhead: result.fee - shares };
}
