import { describe, expect, it } from 'vitest';
import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { parseEnvelope, parseSubTransaction, serializeEnvelope } from '@capacity-exchange/cardano-core';
import { Cardano, Serialization } from '@cardano-sdk/core';
import { HexBlob } from '@cardano-sdk/util';
import {
  assertRoundTrip,
  bytesToHex,
  cborSize,
  decodeTx,
  encodeTx,
  hexToBytes,
  inputRef,
  inputSet,
  makeInput,
  makeOutput,
  outputValue,
  parseSubTransactionBody,
  paymentKeyHash,
  type SubTransactionBody,
  type TxInput,
  withValue,
} from './codec.js';
import {
  buildOfferBody,
  imbalance,
  minUtxoLovelace,
  signSubTransaction,
  SubTransaction,
  verifyWitnesses,
} from './subtx.js';
import { assembleBatch, deductPrice, minFeeFor, offerFee, vkeyWitnessBytes } from './batch.js';
import { receiveOffer, selectFunding, verifyOffer } from '../ces/service.js';
import { OfferRejected, stopsPolling } from '../ces/protocol.js';
import { assertExactlyOneMode } from '../commands/fund.js';
import { batchSourceLabel, parseBatchSource, signingKeyPath, walletDir, withBatchSource } from '../commands/state.js';
import { unitToCliAsset } from '../cardano/value.js';
import type { Value } from '../cardano/value.js';

const POLICY = '7a3f9c2e4b81d05f6a92c7e310bd48f2c95a6e07d31b8f4a2c6e9053';
const UNIT = `${POLICY}${Buffer.from('tokenA').toString('hex')}`;
const CALLER_IN = makeInput('a1'.repeat(32), 0);
const CES_IN = makeInput('3f'.repeat(32), 0);
const address = (hex: string) => Cardano.Address.fromBytes(HexBlob(hex));
const CES_ADDR = address('60cd20fc2b914b2c395d53e13c36799bce3d40fc5a8092ee3064065042');
/** The caller and the party they are paying are different people, and must be different keys. */
const CALLER_ADDR = address(`60${'ab'.repeat(28)}`);
const RECIPIENT_ADDR = address(`60${'cd'.repeat(28)}`);
const CALLER_LOVELACE = 1_180_000n;
const HELD = 100_000_000n;
const SENT = 98_000_000n;
const CHANGE_TOKENS = HELD - SENT;
const CHANGE_LOVELACE = 1_025_780n;
const PRICE_AMOUNT = 1_001_995n;
const PRICE = new Map([[UNIT, PRICE_AMOUNT]]);
/** The change output's minimum, plus comfortably more than the offer's share of the fee. */
const CAPACITY = CHANGE_LOVELACE + 200_000n;
const CALLER_KEY = new Uint8Array(32).fill(7);
const UTXO_COST_PER_BYTE = 4310n;
const TX_FEE_FIXED = 155_381n;
const TX_FEE_PER_BYTE = 44n;
const PP = { txFeeFixed: TX_FEE_FIXED, txFeePerByte: TX_FEE_PER_BYTE };
const QUOTE = { capacity: CAPACITY, priceUnit: UNIT, priceAmount: PRICE_AMOUNT };

const chain = new Map<string, Value>([
  [inputRef(CALLER_IN), { lovelace: CALLER_LOVELACE, assets: new Map([[UNIT, HELD]]) }],
  [inputRef(CES_IN), { lovelace: 12_400_000n, assets: new Map() }],
]);
const lookup = (i: TxInput): Value | undefined => chain.get(inputRef(i));
const resolve = (i: TxInput): Value => lookup(i) ?? { lovelace: 0n, assets: new Map() };

/**
 * What `build` produces and `commit` completes: the recipient's output carrying the caller's own
 * lovelace, and change back to the caller that is short the price in tokens and needs lovelace
 * the caller does not have. It does not balance on its own, and is not meant to.
 */
function offerBody(price = PRICE_AMOUNT): SubTransactionBody {
  return buildOfferBody(
    [CALLER_IN],
    [
      makeOutput(RECIPIENT_ADDR, { lovelace: CALLER_LOVELACE, assets: new Map([[UNIT, SENT]]) }),
      makeOutput(CALLER_ADDR, { lovelace: CHANGE_LOVELACE, assets: new Map([[UNIT, CHANGE_TOKENS - price]]) }),
    ]
  );
}

function offer(body = offerBody(), key = CALLER_KEY): SubTransaction {
  return signSubTransaction(body, key);
}

/** An offer as it arrives at an exchange: bytes in a CIP-0198 envelope. */
function envelopeOf(sub: SubTransaction): string {
  return bytesToHex(serializeEnvelope(sub));
}

/** An envelope around arbitrary sub-transaction bytes, for offers the SDK would refuse to build. */
function rawEnvelope(subTxHex: string, version = 1n, eraTag = 7n): string {
  const writer = new Serialization.CborWriter();
  writer.writeStartArray(3);
  writer.writeInt(version);
  writer.writeInt(eraTag);
  writer.writeTag(Serialization.CborTag.EncodedCborDataItem);
  writer.writeByteString(hexToBytes(subTxHex));
  return writer.encodeAsHex();
}

/** The offer body with one more map entry, written as raw CBOR, appended. */
function offerBodyWith(key: number, valueHex: string): string {
  const body = offerBody().toCbor();
  expect(body.slice(0, 2)).toBe('a2'); // a two-entry map
  const keyHex = key < 24 ? key.toString(16).padStart(2, '0') : `18${key.toString(16).padStart(2, '0')}`;
  return `a3${body.slice(2)}${keyHex}${valueHex}`;
}

/**
 * What `build-raw` gives the exchange: its funding input, and a change output that already
 * gives up the lovelace the offer needs and takes in the tokens it pays, at a fee of zero.
 */
function cesDraft(funding = resolve(CES_IN).lovelace) {
  const body = new Serialization.TransactionBody(
    inputSet([CES_IN]),
    [makeOutput(CES_ADDR, { lovelace: funding - CHANGE_LOVELACE, assets: new Map(PRICE) })],
    0n
  );
  return decodeTx(encodeTx(new Serialization.Transaction(body, new Serialization.TransactionWitnessSet())));
}

function assemble(subs: SubTransaction[], draft = cesDraft(), res = resolve) {
  return assembleBatch({
    draft,
    changeIndex: 0,
    subs,
    resolve: res,
    txFeeFixed: TX_FEE_FIXED,
    txFeePerByte: TX_FEE_PER_BYTE,
    utxoCostPerByte: UTXO_COST_PER_BYTE,
    witnessCount: 1,
  });
}

/**
 * An offer whose body was encoded in a way the SDK never would: the inputs key written as the
 * two-byte `18 00` rather than `00`. Valid CBOR, a different hash — which is exactly the case
 * where a batch builder that re-encodes breaks the author's signature.
 */
function nonCanonicalOffer(): { bytes: Uint8Array; bodyBytes: Uint8Array } {
  const canonical = offerBody().toCbor();
  expect(canonical.slice(0, 4)).toBe('a200'); // a two-entry map, whose first key is 0
  const bodyHex = `a21800${canonical.slice(4)}`;
  const hash = blake2b(hexToBytes(bodyHex), { dkLen: 32 });
  const wits = new Serialization.TransactionWitnessSet();
  wits.setVkeys(
    Serialization.CborSet.fromCore(
      [
        [bytesToHex(ed25519.getPublicKey(CALLER_KEY)), bytesToHex(ed25519.sign(hash, CALLER_KEY))] as ReturnType<
          Serialization.VkeyWitness['toCore']
        >,
      ],
      Serialization.VkeyWitness.fromCore
    )
  );
  return { bytes: hexToBytes(`83${bodyHex}${wits.toCbor()}f6`), bodyBytes: hexToBytes(bodyHex) };
}

function parsed(bytes: Uint8Array): SubTransaction {
  const result = parseSubTransaction(bytes);
  if (result.status !== 'ok') {
    throw new Error(`expected a sub-transaction, got ${result.status}`);
  }
  return result.value;
}

function rejection(fn: () => unknown): OfferRejected {
  try {
    fn();
  } catch (err) {
    if (err instanceof OfferRejected) {
      return err;
    }
    throw err;
  }
  throw new Error('expected a rejection');
}

describe('codec', () => {
  it("writes Dijkstra's three-element frame and round-trips a transaction byte for byte", () => {
    const hex = encodeTx(cesDraft());
    expect(hex.startsWith('83')).toBe(true);
    expect(encodeTx(decodeTx(hex))).toBe(hex);
    expect(() => assertRoundTrip(hex)).not.toThrow();
  });

  it('keeps a Babbage output a map, with its datum and script ref, when its value changes', () => {
    // A map output carrying a multiasset value (1), an inline datum (2) and a native script ref (3).
    const value = `821a00120160a1581c${POLICY}a146${Buffer.from('tokenA').toString('hex')}1a05f5e100`;
    const datum = '8201d81843d87980';
    const script = `8200${'8200581c' + '03'.repeat(28)}`;
    const scriptRef = `d8185822${script}`;
    const raw = `a4005839${'00' + 'cd'.repeat(56)}01${value}02${datum}03${scriptRef}`;
    const output = Serialization.TransactionOutput.fromCbor(HexBlob(raw));
    expect(withValue(output, outputValue(output)).toCbor()).toBe(raw);

    const richer = withValue(output, { ...outputValue(output), lovelace: 2_000_000n });
    expect(richer.isBabbageOutput()).toBe(true);
    expect(richer.datum()?.toCbor()).toBe(output.datum()?.toCbor());
    expect(richer.scriptRef()?.toCbor()).toBe(output.scriptRef()?.toCbor());
    expect(outputValue(richer).assets.get(UNIT)).toBe(100_000_000n);
  });

  it('spells assets for --tx-out with a dot, unlike the concatenated UTxO form', () => {
    expect(unitToCliAsset(UNIT)).toBe(`${POLICY}.${Buffer.from('tokenA').toString('hex')}`);
    expect(unitToCliAsset(POLICY)).toBe(POLICY);
  });

  it('reads the payment key hash out of a bech32 address', () => {
    const bech32 = 'addr_test1vrxjplptj99jcw2a20sncdnen08r6s8ut2qf9m3svsr9qssy6kvq6';
    expect(paymentKeyHash(Cardano.Address.fromBech32(bech32))).toBe(
      'cd20fc2b914b2c395d53e13c36799bce3d40fc5a8092ee3064065042'
    );
  });
});

describe('offer envelope', () => {
  it('carries the sub-transaction verbatim under tag 24', () => {
    const { bytes } = nonCanonicalOffer();
    const envelope = serializeEnvelope(parsed(bytes));
    // [1, 7, 24(bytes)]: d818 is tag 24's head.
    expect(bytesToHex(envelope).startsWith('8301' + '07' + 'd818')).toBe(true);
    const result = parseEnvelope(envelope);
    expect(result.status === 'ok' && result.value.toCbor()).toBe(bytesToHex(bytes));
  });
});

describe('offer', () => {
  it("signs its own body hash with the caller's key, not any batch", () => {
    const sub = offer();
    const [witness] = sub.witnessSet().vkeys()!.values();
    const bodyHash = blake2b(hexToBytes(sub.body().toCbor()), { dkLen: 32 });
    expect(sub.getId()).toBe(bytesToHex(bodyHash));
    expect(ed25519.verify(hexToBytes(witness.signature()), bodyHash, hexToBytes(witness.vkey()))).toBe(true);
    expect(witness.vkey()).toBe(bytesToHex(ed25519.getPublicKey(CALLER_KEY)));
  });

  it('offers exactly the price in tokens and needs exactly the change lovelace', () => {
    const delta = imbalance(offer(), resolve);
    expect(delta.assets.get(UNIT)).toBe(PRICE_AMOUNT);
    expect(delta.lovelace).toBe(-CHANGE_LOVELACE);
  });

  it('hashes an arriving offer as it was encoded, not as the SDK would re-encode it', () => {
    const { bytes, bodyBytes } = nonCanonicalOffer();
    const sub = parsed(bytes);
    expect(sub.getId()).toBe(bytesToHex(blake2b(bodyBytes, { dkLen: 32 })));
    expect(() => verifyWitnesses(sub)).not.toThrow();
    // Rebuilding from the decoded fields forgets the encoding, so the hash changes and the
    // signature no longer verifies.
    const reencoded = SubTransaction.fromCore(sub.toCore());
    expect(reencoded.getId()).not.toBe(sub.getId());
    expect(() => verifyWitnesses(reencoded)).toThrow(/does not verify/);
  });

  it('refuses an offer with no witnesses', () => {
    const sub = new SubTransaction(offerBody(), new Serialization.TransactionWitnessSet());
    expect(() => verifyWitnesses(sub)).toThrow(/no vkey witnesses/);
  });

  it('gives a token-bearing output more than a bare ada one', () => {
    const bare = minUtxoLovelace(makeOutput(CES_ADDR, { lovelace: 0n, assets: new Map() }), UTXO_COST_PER_BYTE);
    const withToken = minUtxoLovelace(
      makeOutput(CES_ADDR, { lovelace: 0n, assets: new Map([[UNIT, 1n]]) }),
      UTXO_COST_PER_BYTE
    );
    expect(withToken).toBeGreaterThan(bare);
  });
});

describe('receiveOffer (stateless checks)', () => {
  it('accepts a well-formed offer and names who signed it', () => {
    const sub = offer();
    const { sub: received, signers } = receiveOffer(envelopeOf(sub));
    expect(received.getId()).toBe(sub.getId());
    expect(signers).toEqual([bytesToHex(ed25519.getPublicKey(CALLER_KEY))]);
  });

  it('refuses bytes that are not an envelope as malformed', () => {
    expect(rejection(() => receiveOffer('deadbeef')).code).toBe('malformed');
  });

  it('refuses an envelope version it does not know as unsupported-version', () => {
    const hex = rawEnvelope(offer().toCbor(), 2n);
    expect(rejection(() => receiveOffer(hex)).code).toBe('unsupported-version');
  });

  it('refuses a witness that does not sign the body it arrived with', () => {
    const signed = offer();
    const tampered = new SubTransaction(offerBody(1n), signed.witnessSet());
    const err = rejection(() => receiveOffer(envelopeOf(tampered)));
    expect(err.code).toBe('malformed');
    expect(err.message).toMatch(/does not verify/);
  });

  const KEY_HASH = '03'.repeat(28);
  const CREDENTIAL = `8200581c${KEY_HASH}`;
  const REWARD_ACCOUNT = `581de0${'04'.repeat(28)}`;
  const ONE_ADA = '1a000f4240';

  it.each([
    [4, 'certificates', '80'],
    [5, 'withdrawals', 'a0'],
    [9, 'mint', 'a0'],
    [14, 'guards', `d9010281581c${KEY_HASH}`],
    // The three below are what `sub_transaction_body` actually permits and `computeBalance`
    // cannot see: 22 and 25 move lovelace without touching an output, and 24 constrains the
    // batch that carries the offer.
    [22, 'a treasury donation', ONE_ADA],
    [24, 'required top-level guards', `a1${CREDENTIAL}f6`],
    [25, 'direct deposits', `a1${REWARD_ACCOUNT}${ONE_ADA}`],
    [26, 'account balance intervals', `a1${CREDENTIAL}8200f6`],
  ])('is not interested in an offer carrying body key %i (%s)', (key, label, value) => {
    const body = parseSubTransactionBody(offerBodyWith(key, value));
    const err = rejection(() => receiveOffer(envelopeOf(offer(body))));
    expect(err.code).toBe('not-interested');
    expect(err.message).toContain(label);
  });

  it.each([
    [2, 'a fee', '00'],
    [13, 'collateral inputs', `d9010281825820${'a1'.repeat(32)}00`],
    [23, 'nested sub-transactions', () => `d9010281${offer().toCbor()}`],
  ])('refuses an offer carrying top-level-only body key %i (%s) as malformed', (key, _label, value) => {
    const valueHex = typeof value === 'function' ? value() : value;
    const subTx = `83${offerBodyWith(key, valueHex)}a0f6`;
    const err = rejection(() => receiveOffer(rawEnvelope(subTx)));
    expect(err.code).toBe('malformed');
    expect(err.message).toMatch(/Top-level-only/);
  });

  it.each([
    [3, 'a time-to-live'],
    [8, 'a validity interval start'],
  ])('accepts an offer bounded by body key %i (%s), which is how an offer expires', (key) => {
    const body = parseSubTransactionBody(offerBodyWith(key, '1864'));
    expect(() => receiveOffer(envelopeOf(offer(body)))).not.toThrow();
  });
});

describe('verifyOffer (chain-state checks)', () => {
  it('accepts an offer that pays the quote for what it needs', () => {
    const sub = offer();
    const verified = verifyOffer(sub, lookup, QUOTE, PP);
    expect(verified.lovelaceNeeded).toBe(CHANGE_LOVELACE);
    expect(verified.offered.get(UNIT)).toBe(PRICE_AMOUNT);
    expect(verified.feeShare).toBe(offerFee(cborSize(sub.toCbor()), TX_FEE_FIXED, TX_FEE_PER_BYTE));
  });

  it('marks an offer whose input is already spent as invalidated', () => {
    const gone = () => undefined;
    expect(rejection(() => verifyOffer(offer(), gone, QUOTE, PP)).code).toBe('invalidated');
  });

  it('is not interested in an offer that pays less than the quote', () => {
    const cheap = offer(offerBody(PRICE_AMOUNT - 1n));
    const err = rejection(() => verifyOffer(cheap, lookup, QUOTE, PP));
    expect(err.code).toBe('not-interested');
    expect(err.message).toMatch(/quote was for/);
  });

  it('is not interested in an offer that needs more lovelace than was quoted for', () => {
    const err = rejection(() => verifyOffer(offer(), lookup, { ...QUOTE, capacity: CHANGE_LOVELACE }, PP));
    expect(err.code).toBe('not-interested');
    expect(err.message).toMatch(/more than the/);
  });

  it("is not interested in an offer that spends the service's own UTxO", () => {
    const body = buildOfferBody([CES_IN], [makeOutput(CALLER_ADDR, { lovelace: 1_000_000n, assets: new Map() })]);
    const own = { txHash: CES_IN.transactionId(), index: 0, value: resolve(CES_IN) };
    const err = rejection(() => verifyOffer(offer(body), lookup, QUOTE, PP, [own]));
    expect(err.message).toMatch(/belongs to this service/);
  });

  it('is not interested in an offer that needs tokens from its batch', () => {
    const body = buildOfferBody(
      [CALLER_IN],
      [makeOutput(RECIPIENT_ADDR, { lovelace: CALLER_LOVELACE, assets: new Map([[UNIT, HELD + 1n]]) })]
    );
    expect(rejection(() => verifyOffer(offer(body), lookup, QUOTE, PP)).message).toMatch(/only supplies ADA/);
  });
});

describe('selectFunding', () => {
  it('funds from the UTxO with the most lovelace, even one holding tokens it was paid', () => {
    const paid = { txHash: 'b2'.repeat(32), index: 0, value: { lovelace: 9_000_000n, assets: new Map(PRICE) } };
    const bare = { txHash: 'c3'.repeat(32), index: 0, value: { lovelace: 2_000_000n, assets: new Map() } };
    expect(selectFunding([bare, paid], 'addr')).toBe(paid);
  });

  it('refuses a wallet with nothing in it', () => {
    expect(() => selectFunding([], 'addr')).toThrow(/no UTxO/);
  });
});

describe('assembleBatch', () => {
  it('produces a balanced batch carrying the offer at key 23', () => {
    const sub = offer();
    const result = assemble([sub]);
    expect(result.balance.balances).toBe(true);
    const body = result.parent.body();
    expect(
      body
        .subTransactions()
        ?.values()
        .map((s) => s.getId())
    ).toEqual([sub.getId()]);
    expect(result.fee).toBe(minFeeFor(result.signedSizeBytes, TX_FEE_FIXED, TX_FEE_PER_BYTE));
    // The exchange paid the fee out of its own change.
    const change = outputValue(body.outputs()[0]);
    expect(change.lovelace).toBe(resolve(CES_IN).lovelace - CHANGE_LOVELACE - result.fee);
    expect(change.assets.get(UNIT)).toBe(PRICE_AMOUNT);
  });

  it('encodes sub_transactions as a CBOR set, as the ledger requires', () => {
    // Tag 258 is the set wrapper; d9 0102 is its CBOR head. The CDDL has
    // `sub_transactions = nonempty_oset<sub_transaction>`: a list on the wire, even though the
    // ledger holds it in memory as a map keyed by TxId.
    expect(encodeTx(assemble([offer()]).parent)).toContain('17d9010281');
  });

  it('inserts the offer verbatim, so a signature over an unusual encoding survives', () => {
    const { bytes } = nonCanonicalOffer();
    const encoded = encodeTx(assemble([parsed(bytes)]).parent);
    expect(encoded).toContain(bytesToHex(bytes));
    // And it is still there, still verifying, once the batch is read back.
    const [carried] = decodeTx(encoded).body().subTransactions()!.values();
    expect(carried.toCbor()).toBe(bytesToHex(bytes));
    expect(() => verifyWitnesses(carried)).not.toThrow();
  });

  it("declares the offer's inputs as reference inputs so the node resolves them", () => {
    const result = assemble([offer()]);
    const refs = result.parent.body().referenceInputs()?.values().map(inputRef);
    expect(refs).toEqual([inputRef(CALLER_IN)]);
    expect(result.declaredReferenceInputs.map(inputRef)).toEqual([inputRef(CALLER_IN)]);
  });

  it('counts the bytes a vkey witness really adds, so the fee covers the signed size', () => {
    // Measured rather than assumed: an under-count here silently produces a batch the node
    // rejects for too low a fee.
    // Distinct keys: the SDK keeps one witness per vkey.
    const witness = (i: number) =>
      [bytesToHex(new Uint8Array(32).fill(i)), bytesToHex(new Uint8Array(64).fill(2))] as ReturnType<
        Serialization.VkeyWitness['toCore']
      >;
    const size = (n: number) => {
      const wits = new Serialization.TransactionWitnessSet();
      if (n > 0) {
        wits.setVkeys(
          Serialization.CborSet.fromCore(
            Array.from({ length: n }, (_, i) => witness(i + 1)),
            Serialization.VkeyWitness.fromCore
          )
        );
      }
      return cborSize(encodeTx(new Serialization.Transaction(cesDraft().body(), wits)));
    };
    const unwitnessed = size(0);
    expect(vkeyWitnessBytes(0)).toBe(0);
    for (const n of [1, 2, 3, 5]) {
      expect(vkeyWitnessBytes(n)).toBe(size(n) - unwitnessed);
    }
  });

  it('refuses two offers that spend the same input', () => {
    expect(() => assemble([offer(), offer(offerBody(PRICE_AMOUNT + 1n))])).toThrow(/same input/);
  });

  it("refuses when the exchange's change would fall below its minimum", () => {
    const small = new Map(chain);
    small.set(inputRef(CES_IN), { lovelace: 1_500_000n, assets: new Map() });
    const res = (i: TxInput) => small.get(inputRef(i))!;
    expect(() => assemble([offer()], cesDraft(1_500_000n), res)).toThrow(/below its .* minimum/);
  });
});

describe('deductPrice', () => {
  it("takes the price out of the caller's change, not the recipient's output", () => {
    const outputs = [
      makeOutput(RECIPIENT_ADDR, { lovelace: 1_180_000n, assets: new Map([[UNIT, SENT]]) }),
      makeOutput(CALLER_ADDR, { lovelace: CHANGE_LOVELACE, assets: new Map([[UNIT, CHANGE_TOKENS]]) }),
    ];
    const { outputs: updated, index } = deductPrice(outputs, PRICE, CALLER_ADDR);
    expect(index).toBe(1);
    expect(outputValue(updated[1]).assets.get(UNIT)).toBe(CHANGE_TOKENS - PRICE_AMOUNT);
    // The person being paid is untouched.
    expect(outputValue(updated[0]).assets.get(UNIT)).toBe(SENT);
  });

  it("refuses rather than billing the recipient when the caller's change cannot cover the price", () => {
    const outputs = [
      makeOutput(RECIPIENT_ADDR, { lovelace: 1_180_000n, assets: new Map([[UNIT, 100_000_000n]]) }),
      makeOutput(CALLER_ADDR, { lovelace: CHANGE_LOVELACE, assets: new Map([[UNIT, 1n]]) }),
    ];
    expect(() => deductPrice(outputs, PRICE, CALLER_ADDR)).toThrow(/belongs to someone else/);
  });

  it('refuses when no output holds enough of the payment asset', () => {
    const outputs = [makeOutput(CALLER_ADDR, { lovelace: 1_180_000n, assets: new Map() })];
    expect(() => deductPrice(outputs, PRICE, CALLER_ADDR)).toThrow(/No output holds/);
  });
});

describe('wallet paths', () => {
  it('resolves a wallet given either as a directory or as the key file itself', () => {
    expect(signingKeyPath('wallets/caller')).toBe('wallets/caller/payment.skey');
    expect(signingKeyPath('wallets/caller/payment.skey')).toBe('wallets/caller/payment.skey');
    expect(walletDir('wallets/caller')).toBe('wallets/caller');
    expect(walletDir('wallets/caller/payment.skey')).toBe('wallets/caller');
  });

  it('treats a bare key file as living in the current directory, not a truncated one', () => {
    expect(walletDir('payment.skey')).toBe('.');
  });
});

describe('batch provenance', () => {
  it('round-trips a simulated batch through the envelope description', () => {
    const description = withBatchSource('Ledger Cddl Format', { simulated: true });
    expect(parseBatchSource(description)).toEqual({ simulated: true });
    expect(batchSourceLabel(parseBatchSource(description))).toBe('[simulated CES]');
  });

  it('round-trips a real exchange, and never calls it simulated', () => {
    const description = withBatchSource('Ledger Cddl Format', { simulated: false, url: 'https://ces.example' });
    expect(parseBatchSource(description)).toEqual({ simulated: false, url: 'https://ces.example' });
    expect(batchSourceLabel(parseBatchSource(description))).toBe('[CES https://ces.example]');
  });

  it('keeps whatever the description already said', () => {
    expect(withBatchSource('Ledger Cddl Format', { simulated: true })).toContain('Ledger Cddl Format');
    expect(withBatchSource('', { simulated: true })).toBe('batch built by simulated CES');
  });

  it('says nothing when no source was recorded, rather than assuming one', () => {
    expect(parseBatchSource('Ledger Cddl Format')).toBeUndefined();
    expect(parseBatchSource(undefined)).toBeUndefined();
    expect(withBatchSource('Ledger Cddl Format', undefined)).toBe('Ledger Cddl Format');
    expect(batchSourceLabel(undefined)).toBeUndefined();
  });
});

describe('fund', () => {
  it('requires exactly one mode, so a run can never silently simulate', () => {
    expect(() => assertExactlyOneMode({})).toThrow(/exactly one/);
    expect(() => assertExactlyOneMode({ simulateCes: true, cesUrl: 'https://x' })).toThrow(/exactly one/);
    expect(() => assertExactlyOneMode({ simulateCes: true })).not.toThrow();
    expect(() => assertExactlyOneMode({ cesUrl: 'https://x' })).not.toThrow();
  });

  it('keeps asking the exchange until the batch is submitted, then turns to the chain', () => {
    for (const state of ['received', 'verified', 'included-in-batch'] as const) {
      expect(stopsPolling(state)).toBe(false);
    }
    for (const state of ['submitted', 'rejected', 'confirmed', 'expired', 'invalidated'] as const) {
      expect(stopsPolling(state)).toBe(true);
    }
  });
});
