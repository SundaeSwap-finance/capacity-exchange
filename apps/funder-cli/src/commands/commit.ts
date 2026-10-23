import { ed25519 } from '@noble/curves/ed25519.js';
import { serializeEnvelope } from '@capacity-exchange/cardano-core';
import { Cardano } from '@cardano-sdk/core';
import { CardanoCli } from '../cardano/cli.js';
import { assetLabel } from '../cardano/value.js';
import type { Config } from '../config.js';
import { formatAsset, step, wrote } from '../log.js';
import { deductPrice, offerFee } from '../tx/batch.js';
import { bytesToHex, cborSize, outputValue, parseSubTransactionBody, paymentKeyHash } from '../tx/codec.js';
import { keyHash, readSigningKey, signSubTransaction } from '../tx/subtx.js';
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

export interface CommitOptions {
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
export function runCommit(config: Config, options: CommitOptions): void {
  const draft = readJson<StoredDraft>(options.draft, 'offer draft');
  const quote = readJson<StoredQuote>(options.quote, 'quote');
  if (quote.capacity !== draft.capacity) {
    throw new Error(
      `The quote was for ${quote.capacity} lovelace but this offer needs ${draft.capacity}. ` +
        'Quote again with the capacity `build` printed.'
    );
  }

  const body = parseSubTransactionBody(draft.body);
  const price = new Map([[quote.priceUnit, BigInt(quote.priceAmount)]]);
  const callerAddress = Cardano.Address.fromBech32(draft.callerAddress);
  const { outputs, index } = deductPrice(body.outputs(), price, callerAddress);
  body.setOutputs(outputs);
  step(
    'commit',
    `price ${formatAsset(BigInt(quote.priceAmount))} ${assetLabel(quote.priceUnit)} left out of change output #${index}`
  );

  const keyFile = signingKeyPath(options.callerWallet);
  const signingKey = readSigningKey(keyFile);
  assertKeyOwnsAddress(signingKey, callerAddress, keyFile, draft.callerAddress);

  const sub = signSubTransaction(body, signingKey);

  // `build` asked for capacity assuming an upper bound on the signed size. If the offer came
  // out larger, the exchange would be carrying bytes nobody paid for.
  const pp = new CardanoCli(config).queryProtocolParams();
  const size = cborSize(sub.toCbor());
  const share = offerFee(size, pp.txFeeFixed, pp.txFeePerByte);
  const capacity = BigInt(draft.capacity);
  const changeLovelace = outputValue(outputs[index]).lovelace;
  if (share + changeLovelace > capacity) {
    throw new Error(
      `The signed offer is ${size} bytes, which needs ${share + changeLovelace} lovelace ` +
        `of capacity; only ${capacity} was quoted.`
    );
  }

  step('commit', `offer ${sub.getId()}  (${size} bytes, signed by the caller's key)`);
  step('commit', 'the offer id is its TxId: its outputs will appear on chain under it');

  const offerPath = workPath(config, ARTIFACTS.offer);
  const offer: StoredOffer = { offerId: sub.getId(), envelope: bytesToHex(serializeEnvelope(sub)) };
  writeJson(offerPath, offer);
  wrote('commit', offerPath);
  step(
    'commit',
    `next: ces-fund fund ${offerPath} --quote ${options.quote} --simulate-ces --simulated-ces-wallet <dir>`
  );
}

/**
 * The ledger wants a witness from the key behind the input's address. Signing with any other
 * key produces an offer that verifies on its own terms and is rejected on chain, which is a
 * confusing way to learn the wrong wallet was named.
 */
function assertKeyOwnsAddress(signingKey: Uint8Array, address: Cardano.Address, keyFile: string, bech32: string): void {
  if (keyHash(bytesToHex(ed25519.getPublicKey(signingKey))) !== paymentKeyHash(address)) {
    throw new Error(`${keyFile} is not the key behind ${bech32}, which the offer spends from`);
  }
}
