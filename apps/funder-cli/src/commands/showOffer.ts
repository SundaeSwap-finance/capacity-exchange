import { parseEnvelope } from '@capacity-exchange/cardano-core';
import { Serialization } from '@cardano-sdk/core';
import { CardanoCli } from '../cardano/cli.js';
import type { Value } from '../cardano/value.js';
import type { Config } from '../config.js';
import { plain } from '../log.js';
import { hexToBytes, inputRef, parseSubTransactionBody, paymentKeyHash, type TxInput } from '../tx/codec.js';
import { showImbalance, showSubTransaction } from '../tx/show.js';
import { imbalance, keyHash, SubTransaction, verifyWitnesses } from '../tx/subtx.js';
import { readJson, type StoredDraft, type StoredOffer } from './state.js';

export interface ShowOfferOptions {
  offline?: boolean;
}

/**
 * Renders the caller's offer, either as `build` drafted it or as `commit` signed it. Neither is
 * a transaction `cardano-cli` can read, since a sub-transaction never travels on its own.
 */
export function runShowOffer(config: Config, file: string, options: ShowOfferOptions): void {
  const parsed = readJson<Partial<StoredDraft & StoredOffer>>(file, 'offer');
  const addresses = new Map<string, string>();
  let sub: SubTransaction;

  if (parsed.envelope) {
    const envelope = parseEnvelope(hexToBytes(parsed.envelope));
    if (envelope.status !== 'ok') {
      throw new Error(
        `${file} does not carry a readable offer: ${envelope.status === 'malformed' ? envelope.reason : envelope.status}`
      );
    }
    sub = envelope.value;
    let signers: string[] = [];
    let verdict: string;
    try {
      signers = verifyWitnesses(sub);
      verdict = '✓ signature verifies against the offer body';
    } catch (err) {
      verdict = `✗ ${(err as Error).message}`;
    }
    // An output paying the signer's own key is theirs; nothing else can be said from the offer.
    const signerHashes = new Set(signers.map(keyHash));
    for (const output of sub.body().outputs()) {
      const owner = paymentKeyHash(output.address());
      if (owner && signerHashes.has(owner)) {
        addresses.set(output.address().toBech32(), 'caller');
      }
    }
    plain(`OFFER (signed by ${signers.map((k) => `${k.slice(0, 4)}…`).join(', ') || 'nobody'})`);
    plain(`  id       ${sub.getId()}`);
    plain(`  ${verdict}`);
    if (parsed.offerId && parsed.offerId !== sub.getId()) {
      plain(`  ✗ file says id ${parsed.offerId}, which is not what the envelope carries`);
    }
  } else if (parsed.body && parsed.callerAddress) {
    sub = new SubTransaction(parseSubTransactionBody(parsed.body), new Serialization.TransactionWitnessSet());
    addresses.set(parsed.callerAddress, 'caller');
    plain('OFFER DRAFT (unsigned; the price goes in at `commit`)');
  } else {
    throw new Error(
      `${file} is neither an offer.draft.json written by \`build\` nor an offer.json written by \`commit\``
    );
  }

  // Before inclusion the inputs are unspent and can be priced; afterwards they cannot.
  const resolved = new Map<string, Value>();
  if (!options.offline) {
    const refs = sub.body().inputs().values().map(inputRef);
    for (const utxo of new CardanoCli(config).queryUtxoByRefs(refs)) {
      resolved.set(`${utxo.txHash}#${utxo.index}`, utxo.value);
    }
  }
  const allResolved = sub
    .body()
    .inputs()
    .values()
    .every((i) => resolved.has(inputRef(i)));
  const resolve = allResolved ? (input: TxInput): Value => resolved.get(inputRef(input))! : undefined;

  plain('');
  showSubTransaction('SUB-TRANSACTION', sub, resolve, addresses);
  showImbalance(sub, resolve);

  // The draft records what `build` asked for, and the difference is the offer's fee share.
  if (parsed.capacity && resolve) {
    const capacity = BigInt(parsed.capacity);
    const needs = -imbalance(sub, resolve).lovelace;
    plain('');
    plain(
      `CAPACITY  ${capacity} lovelace = ${needs} needed + ${capacity - needs} fee share   (quote --capacity ${capacity})`
    );
  }
}
