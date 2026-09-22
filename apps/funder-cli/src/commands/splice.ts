import { decode } from 'cbor2';
import { CardanoCli } from '../cardano/cli.js';
import type { Value } from '../cardano/value.js';
import { assetLabel, emptyValue } from '../cardano/value.js';
import type { Config } from '../config.js';
import { check, formatAda, formatAsset, step, wrote } from '../log.js';
import {
  assertRoundTrip,
  BODY_INPUTS,
  decodeTx,
  encodeTx,
  hexToBytes,
  readEnvelope,
  readInputs,
  type TxInput,
  writeEnvelope,
} from '../tx/codec.js';
import { spliceOffer } from '../tx/splice.js';
import { decodeSubTransaction } from '../tx/subtx.js';
import { ARTIFACTS, readJson, type StoredOffer, type StoredQuote, withOfferSource, workPath } from './state.js';

/**
 * Merges the exchange's partial transaction into the caller's, balances the bundle, and
 * verifies the offer before trusting it. This is the only step with no cardano-cli equivalent.
 */
export interface SpliceOptions {
  draft: string;
  quote: string;
  offer: string;
}

export function runSplice(config: Config, options: SpliceOptions): void {
  const cli = new CardanoCli(config);
  const quote = readJson<StoredQuote>(options.quote, 'quote');
  const offer = readJson<StoredOffer>(options.offer, 'offer');

  const draftPath = options.draft;
  const envelope = readEnvelope(draftPath);
  assertRoundTrip(envelope.cborHex);
  const parent = decodeTx(envelope.cborHex);

  const sub = decodeSubTransaction(decode(hexToBytes(offer.serializedTx)) as unknown[]);

  // Price the sub-transaction's inputs, which the caller must look up for themselves rather
  // than take the exchange's word for.
  step('splice', 'resolving sub-transaction inputs via cardano-cli query utxo');
  const refs = sub.inputs.map((i) => `${i.txHash}#${i.index}`);
  const resolved = new Map<string, Value>();
  for (const utxo of cli.queryUtxoByRefs(refs)) {
    resolved.set(`${utxo.txHash}#${utxo.index}`, utxo.value);
  }
  for (const ref of refs) {
    const value = resolved.get(ref);
    if (!value) {
      throw new Error(`Sub-transaction input ${ref} does not exist on chain`);
    }
    step('splice', `  ${ref.slice(0, 6)}…#${ref.split('#')[1]}  →  ${formatAda(value.lovelace)} ADA`);
  }

  const parentInputs = readInputs(parent.body, BODY_INPUTS);
  for (const utxo of cli.queryUtxoByRefs(parentInputs.map((i) => `${i.txHash}#${i.index}`))) {
    resolved.set(`${utxo.txHash}#${utxo.index}`, utxo.value);
  }
  const resolve = (input: TxInput): Value => resolved.get(`${input.txHash}#${input.index}`) ?? emptyValue();

  const price = new Map([[quote.priceUnit, BigInt(quote.priceAmount)]]);
  const pp = cli.queryProtocolParams();

  step('splice', 'verifying offer');
  const result = spliceOffer({
    parent,
    sub,
    price,
    resolve,
    txFeeFixed: pp.txFeeFixed,
    txFeePerByte: pp.txFeePerByte,
    witnessCount: 1,
  });

  check(
    'splice',
    `${assetLabel(quote.priceUnit)} taken (${formatAsset(BigInt(quote.priceAmount))}) matches quoted price`
  );
  check('splice', 'no sub-transaction input belongs to the caller');
  check('splice', 'no certs, withdrawals, mint, votes or proposals');
  step('splice', `released = ${formatAda(result.released)} ADA`);
  step('splice', `rebuilt caller output #${result.paymentOutputIndex} to pay the price`);
  step('splice', 'inserted sub-transaction at body key 23');
  if (result.declaredReferenceInputs.length > 0) {
    const refs = result.declaredReferenceInputs.map((i) => `${i.txHash.slice(0, 6)}\u2026#${i.index}`);
    step('splice', `declared ${refs.join(', ')} as reference inputs so the node resolves them`);
  }
  step('splice', `fee = ${result.fee} (balances the bundle)`);
  check('splice', `min fee ${result.minFee} ≤ ${result.fee}  — padding sufficient (${result.surplus} surplus)`);

  const nestedPath = workPath(config, ARTIFACTS.nested);
  writeEnvelope(nestedPath, {
    ...envelope,
    description: withOfferSource(envelope.description, offer.source),
    cborHex: encodeTx(result.parent),
  });
  const bytes = Buffer.from(encodeTx(result.parent), 'hex').length;
  step('splice', `${bytes} bytes unsigned, ~${result.signedSizeBytes} signed`);
  wrote('splice', nestedPath);
  step('splice', `next: ces-fund sign ${nestedPath} --caller-wallet <dir>`);
}
