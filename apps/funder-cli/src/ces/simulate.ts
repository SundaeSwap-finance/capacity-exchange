import { randomBytes } from 'node:crypto';
import { encode } from 'cbor2';
import type { CardanoCli, ProtocolParams, Utxo } from '../cardano/cli.js';
import { utxoRef } from '../cardano/cli.js';
import { asSet, bytesToHex, encodeInput } from '../tx/codec.js';
import { buildSubTransaction, readSigningKey, type SubTransaction } from '../tx/subtx.js';
import type { Currency, OfferResponse } from './client.js';

/**
 * Extra lovelace the exchange adds to the caller's fee estimate so the fee still covers the
 * transaction once its own sub-transaction has been spliced in. The caller estimated the fee
 * for a transaction that did not yet contain the offer.
 *
 * Two things grow the parent: the sub-transaction itself, and the reference inputs the splice
 * adds so the node will resolve the sub-transaction's inputs at all (see
 * `declareSubTransactionInputs`).
 */
export function padForSubTransaction(sub: SubTransaction, txFeePerByte: bigint, margin: bigint): bigint {
  // +1 for the body key, and the set wrapper the sub-transaction list is carried in.
  const subBytes = encode(sub.items).length + 6;
  const refBytes = encode(asSet(sub.inputs.map(encodeInput))).length + 1;
  return BigInt(subBytes + refBytes) * txFeePerByte + margin;
}

export interface SimulateOfferParams {
  cli: CardanoCli;
  signingKeyFile: string;
  scratchDir: string;
  feeEstimate: bigint;
  price: Map<string, bigint>;
  priceCurrency: Currency;
  protocolParams: ProtocolParams;
  /** Safety margin on top of the computed pad, in lovelace. */
  margin: bigint;
  offerTtlSeconds: number;
}

export interface SimulatedOffer {
  response: OfferResponse;
  address: string;
  selected: Utxo;
  released: bigint;
  pad: bigint;
  sub: SubTransaction;
}

/**
 * Stands in for the exchange's POST /offer. Everything here is real except the parts a real
 * exchange would own: choosing which UTxO to commit, locking it against concurrent offers,
 * and settling the quote. The cryptography is real because it has to be — the node rejects
 * anything else.
 */
export function simulateOffer(params: SimulateOfferParams): SimulatedOffer {
  const {
    cli,
    signingKeyFile,
    scratchDir,
    feeEstimate,
    price,
    priceCurrency,
    protocolParams,
    margin,
    offerTtlSeconds,
  } = params;

  const signingKey = readSigningKey(signingKeyFile);
  const address = cli.deriveAddress(signingKeyFile, scratchDir);

  const utxos = cli.queryUtxo(address);
  const adaOnly = utxos.filter((u) => u.value.assets.size === 0);
  if (adaOnly.length === 0) {
    throw new Error(`Simulated exchange wallet ${address} has no ADA-only UTxO to fund an offer with`);
  }
  // Largest first: the most headroom for the payment output plus change.
  const selected = adaOnly.reduce((a, b) => (b.value.lovelace > a.value.lovelace ? b : a));

  const addressBytes = decodeBech32Address(address);

  // Build once with an approximate release to measure the sub-transaction, then rebuild with
  // the pad that measurement implies.
  const provisional = buildSubTransaction({
    input: { txHash: selected.txHash, index: selected.index },
    inputValue: selected.value,
    address: addressBytes,
    price,
    released: feeEstimate,
    utxoCostPerByte: protocolParams.utxoCostPerByte,
    signingKey,
  });
  const pad = padForSubTransaction(provisional, protocolParams.txFeePerByte, margin);
  const released = feeEstimate + pad;

  const sub = buildSubTransaction({
    input: { txHash: selected.txHash, index: selected.index },
    inputValue: selected.value,
    address: addressBytes,
    price,
    released,
    utxoCostPerByte: protocolParams.utxoCostPerByte,
    signingKey,
  });

  const offerAmount = [...price.values()].reduce((a, b) => a + b, 0n);
  const response: OfferResponse = {
    offerId: `o_${randomBytes(6).toString('hex')}`,
    offerAmount: offerAmount.toString(),
    offerCurrency: priceCurrency,
    serializedTx: bytesToHex(encode(sub.items)),
    expiresAt: new Date(Date.now() + offerTtlSeconds * 1000).toISOString(),
  };

  return { response, address, selected, released, pad, sub };
}

/** cardano-cli has no bech32-decode command, so addresses are decoded here. */
const BECH32_CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

/** Minimal bech32 decode, enough for the address payload cardano-cli hands us. */
export function decodeBech32Address(address: string): Uint8Array {
  const separator = address.lastIndexOf('1');
  if (separator < 0) {
    throw new Error(`Not a bech32 address: ${address}`);
  }
  const dataPart = address.slice(separator + 1).toLowerCase();
  const values: number[] = [];
  for (const char of dataPart) {
    const index = BECH32_CHARSET.indexOf(char);
    if (index < 0) {
      throw new Error(`Invalid bech32 character '${char}' in ${address}`);
    }
    values.push(index);
  }
  // Drop the 6-symbol checksum, then regroup from 5-bit to 8-bit.
  const payload = values.slice(0, -6);
  let acc = 0;
  let bits = 0;
  const out: number[] = [];
  for (const value of payload) {
    acc = (acc << 5) | value;
    bits += 5;
    while (bits >= 8) {
      bits -= 8;
      out.push((acc >> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

export { utxoRef };
