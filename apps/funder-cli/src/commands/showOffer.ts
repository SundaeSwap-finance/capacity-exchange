import { blake2b } from '@noble/hashes/blake2.js';
import { decode } from 'cbor2';
import {
  bytesToHex,
  type CborMap,
  decodeBech32Address,
  decodeEnvelope,
  decodeSubTransaction,
  decodeSubTransactionBytes,
  hexToBytes,
  imbalance,
  type SubTransaction,
  type TxInput,
  type Value,
  verifyWitnesses,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import { CardanoCli } from '../cardano/cli.js';
import type { Config } from '../config.js';
import { plain } from '../log.js';
import { showImbalance, showSubTransaction } from '../tx/show.js';
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
    sub = decodeSubTransactionBytes(decodeEnvelope(hexToBytes(parsed.envelope)));
    let signers: string[] = [];
    let verdict: string;
    try {
      signers = verifyWitnesses(sub);
      verdict = '✓ signature verifies against the offer body';
    } catch (err) {
      verdict = `✗ ${(err as Error).message}`;
    }
    // An output paying the signer's own key is theirs; nothing else can be said from the offer.
    for (const signer of signers) {
      const keyHash = bytesToHex(blake2b(hexToBytes(signer), { dkLen: 28 }));
      for (const output of sub.outputs) {
        if (bytesToHex(output.address.slice(1, 29)) === keyHash) {
          addresses.set(bytesToHex(output.address), 'caller');
        }
      }
    }
    plain(`OFFER (signed by ${signers.map((k) => `${k.slice(0, 4)}…`).join(', ') || 'nobody'})`);
    plain(`  id       ${sub.bodyHash}`);
    plain(`  ${verdict}`);
    if (parsed.offerId && parsed.offerId !== sub.bodyHash) {
      plain(`  ✗ file says id ${parsed.offerId}, which is not what the envelope carries`);
    }
  } else if (parsed.body && parsed.callerAddress) {
    sub = decodeSubTransaction([decode(hexToBytes(parsed.body)) as CborMap, new Map(), null]);
    addresses.set(bytesToHex(decodeBech32Address(parsed.callerAddress)), 'caller');
    plain('OFFER DRAFT (unsigned; the price goes in at `commit`)');
  } else {
    throw new Error(
      `${file} is neither an offer.draft.json written by \`build\` nor an offer.json written by \`commit\``
    );
  }

  // Before inclusion the inputs are unspent and can be priced; afterwards they cannot.
  const resolved = new Map<string, Value>();
  if (!options.offline) {
    const refs = sub.inputs.map((i) => `${i.txHash}#${i.index}`);
    for (const utxo of new CardanoCli(config).queryUtxoByRefs(refs)) {
      resolved.set(`${utxo.txHash}#${utxo.index}`, utxo.value);
    }
  }
  const allResolved = sub.inputs.every((i) => resolved.has(`${i.txHash}#${i.index}`));
  const resolve = allResolved ? (input: TxInput): Value => resolved.get(`${input.txHash}#${input.index}`)! : undefined;

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
