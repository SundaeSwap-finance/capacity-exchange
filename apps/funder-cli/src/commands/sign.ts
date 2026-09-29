import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { decode } from 'cbor2';
import { CardanoCli } from '../cardano/cli.js';
import { assetLabel } from '../cardano/value.js';
import type { Config } from '../config.js';
import { decodeBech32Address } from '../cardano/address.js';
import { formatAsset, step, wrote } from '../log.js';
import { deductPrice, offerFee } from '../tx/batch.js';
import {
  BODY_OUTPUTS,
  bytesToHex,
  type CborMap,
  encodeEnvelope,
  encodeOutput,
  hexToBytes,
  readOutputs,
} from '../tx/codec.js';
import { readSigningKey, signSubTransaction } from '../tx/subtx.js';
import {
  ARTIFACTS,
  readJson,
  signingKeyPath,
  type StoredDraft,
  type StoredOffer,
  type StoredQuote,
  workPath,
  writeJson,
} from './state.js';

export interface SignOptions {
  draft: string;
  quote: string;
  callerWallet: string;
}

/**
 * Takes the quoted price out of the caller's change and signs the offer.
 *
 * The signature covers this sub-transaction's body and nothing else, so it can be given before
 * any batch exists, and whoever carries it can neither alter what it pays nor take more than
 * it leaves on the table. From here on the offer is a bearer instrument: anyone holding it can
 * complete it, until the caller spends the input it commits.
 */
export function runSign(config: Config, options: SignOptions): void {
  const draft = readJson<StoredDraft>(options.draft, 'offer draft');
  const quote = readJson<StoredQuote>(options.quote, 'quote');
  if (quote.capacity !== draft.capacity) {
    throw new Error(
      `The quote was for ${quote.capacity} lovelace but this offer needs ${draft.capacity}. ` +
        'Quote again with the capacity `build` printed.'
    );
  }

  const body = decode(hexToBytes(draft.body)) as CborMap;
  const price = new Map([[quote.priceUnit, BigInt(quote.priceAmount)]]);
  const callerAddress = decodeBech32Address(draft.callerAddress);
  const { outputs, index } = deductPrice(readOutputs(body, BODY_OUTPUTS), price, callerAddress);
  body.set(BODY_OUTPUTS, outputs.map(encodeOutput));
  step(
    'sign',
    `price ${formatAsset(BigInt(quote.priceAmount))} ${assetLabel(quote.priceUnit)} left out of change output #${index}`
  );

  const keyFile = signingKeyPath(options.callerWallet);
  const signingKey = readSigningKey(keyFile);
  assertKeyOwnsAddress(signingKey, callerAddress, keyFile, draft.callerAddress);

  const sub = signSubTransaction(body, signingKey);

  // `build` asked for capacity assuming an upper bound on the signed size. If the offer came
  // out larger, the exchange would be carrying bytes nobody paid for.
  const pp = new CardanoCli(config).queryProtocolParams();
  const share = offerFee(sub.bytes.length, pp.txFeeFixed, pp.txFeePerByte);
  const capacity = BigInt(draft.capacity);
  const changeLovelace = outputs[index].value.lovelace;
  if (share + changeLovelace > capacity) {
    throw new Error(
      `The signed offer is ${sub.bytes.length} bytes, which needs ${share + changeLovelace} lovelace ` +
        `of capacity; only ${capacity} was quoted.`
    );
  }

  step('sign', `offer ${sub.bodyHash}  (${sub.bytes.length} bytes, signed by the caller's key)`);
  step('sign', 'the offer id is its TxId: its outputs will appear on chain under it');

  const offerPath = workPath(config, ARTIFACTS.offer);
  const offer: StoredOffer = { offerId: sub.bodyHash, envelope: bytesToHex(encodeEnvelope(sub.bytes)) };
  writeJson(offerPath, offer);
  wrote('sign', offerPath);
  step('sign', `next: ces-fund fund ${offerPath} --quote ${options.quote} --simulate-ces --simulated-ces-wallet <dir>`);
}

/**
 * The ledger wants a witness from the key behind the input's address. Signing with any other
 * key produces an offer that verifies on its own terms and is rejected on chain, which is a
 * confusing way to learn the wrong wallet was named.
 */
function assertKeyOwnsAddress(signingKey: Uint8Array, address: Uint8Array, keyFile: string, bech32: string): void {
  const keyHash = bytesToHex(blake2b(ed25519.getPublicKey(signingKey), { dkLen: 28 }));
  const paymentPart = bytesToHex(address.slice(1, 29));
  if (keyHash !== paymentPart) {
    throw new Error(`${keyFile} is not the key behind ${bech32}, which the offer spends from`);
  }
}
