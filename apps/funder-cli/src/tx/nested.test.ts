import { describe, expect, it } from 'vitest';
import { decode, encode, Tag } from 'cbor2';
import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import {
  asArray,
  asSet,
  assertRoundTrip,
  BODY_FEE,
  BODY_INPUTS,
  BODY_OUTPUTS,
  BODY_REFERENCE_INPUTS,
  BODY_SUB_TRANSACTIONS,
  bytesToHex,
  type CborMap,
  decodeEnvelope,
  decodeInput,
  decodeOutput,
  decodeTx,
  encodeEnvelope,
  encodeInput,
  encodeOutput,
  encodeTx,
  hexToBytes,
  RawCbor,
  toBigInt,
} from './codec.js';
import {
  buildOfferBody,
  decodeSubTransaction,
  decodeSubTransactionBytes,
  hashBody,
  imbalance,
  minUtxoLovelace,
  signSubTransaction,
  type SubTransaction,
  verifyWitnesses,
} from './subtx.js';
import { assembleBatch, deductPrice, minFeeFor, offerFee, vkeyWitnessBytes } from './batch.js';
import { decodeBech32Address } from '../cardano/address.js';
import { receiveOffer, selectFunding, verifyOffer } from '../ces/service.js';
import { OfferRejected, stopsPolling } from '../ces/protocol.js';
import { assertExactlyOneMode } from '../commands/fund.js';
import { batchSourceLabel, parseBatchSource, signingKeyPath, walletDir, withBatchSource } from '../commands/state.js';
import { unitToCliAsset } from '../cardano/value.js';
import type { Value } from '../cardano/value.js';

const POLICY = '7a3f9c2e4b81d05f6a92c7e310bd48f2c95a6e07d31b8f4a2c6e9053';
const UNIT = `${POLICY}${Buffer.from('tokenA').toString('hex')}`;
const CALLER_IN = { txHash: 'a1'.repeat(32), index: 0 };
const CES_IN = { txHash: '3f'.repeat(32), index: 0 };
const CES_ADDR = hexToBytes('60cd20fc2b914b2c395d53e13c36799bce3d40fc5a8092ee3064065042');
/** The caller and the party they are paying are different people, and must be different keys. */
const CALLER_ADDR = hexToBytes(`60${'ab'.repeat(28)}`);
const RECIPIENT_ADDR = hexToBytes(`60${'cd'.repeat(28)}`);
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
  [`${CALLER_IN.txHash}#0`, { lovelace: CALLER_LOVELACE, assets: new Map([[UNIT, HELD]]) }],
  [`${CES_IN.txHash}#0`, { lovelace: 12_400_000n, assets: new Map() }],
]);
const lookup = (i: { txHash: string; index: number }): Value | undefined => chain.get(`${i.txHash}#${i.index}`);
const resolve = (i: { txHash: string; index: number }): Value => lookup(i) ?? { lovelace: 0n, assets: new Map() };

/**
 * What `build` produces and `commit` completes: the recipient's output carrying the caller's own
 * lovelace, and change back to the caller that is short the price in tokens and needs lovelace
 * the caller does not have. It does not balance on its own, and is not meant to.
 */
function offerBody(price = PRICE_AMOUNT): CborMap {
  return buildOfferBody(
    [CALLER_IN],
    [
      { address: RECIPIENT_ADDR, value: { lovelace: CALLER_LOVELACE, assets: new Map([[UNIT, SENT]]) } },
      { address: CALLER_ADDR, value: { lovelace: CHANGE_LOVELACE, assets: new Map([[UNIT, CHANGE_TOKENS - price]]) } },
    ]
  );
}

function offer(body = offerBody(), key = CALLER_KEY): SubTransaction {
  return signSubTransaction(body, key);
}

/** An offer as it arrives at an exchange: bytes in a CIP-0198 envelope. */
function envelopeOf(sub: SubTransaction): string {
  return bytesToHex(encodeEnvelope(sub.bytes));
}

/**
 * What `build-raw` gives the exchange: its funding input, and a change output that already
 * gives up the lovelace the offer needs and takes in the tokens it pays, at a fee of zero.
 */
function cesDraft(funding = resolve(CES_IN).lovelace) {
  const body: CborMap = new Map<number, unknown>([
    [BODY_INPUTS, asSet([encodeInput(CES_IN)])],
    [
      BODY_OUTPUTS,
      [encodeOutput({ address: CES_ADDR, value: { lovelace: funding - CHANGE_LOVELACE, assets: new Map(PRICE) } })],
    ],
    [BODY_FEE, 0n],
  ]);
  return { items: [body, new Map(), null], body };
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
 * An offer whose body was encoded in a way cbor2 never would: the inputs key written as the
 * two-byte `18 00` rather than `00`. Valid CBOR, a different hash — which is exactly the case
 * where a batch builder that re-encodes breaks the author's signature.
 */
function nonCanonicalOffer(): { bytes: Uint8Array; bodyBytes: Uint8Array } {
  const canonical = encode(offerBody());
  expect(canonical[0]).toBe(0xa2); // a two-entry map, whose first key is 0
  expect(canonical[1]).toBe(0x00);
  const bodyBytes = Uint8Array.from([0xa2, 0x18, 0x00, ...canonical.slice(2)]);
  const hash = blake2b(bodyBytes, { dkLen: 32 });
  const wits = encode(new Map([[0, asSet([[ed25519.getPublicKey(CALLER_KEY), ed25519.sign(hash, CALLER_KEY)]])]]));
  return { bytes: Uint8Array.from([0x83, ...bodyBytes, ...wits, 0xf6]), bodyBytes };
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
  it('round-trips a transaction byte for byte', () => {
    const hex = encodeTx(cesDraft());
    expect(encodeTx(decodeTx(hex))).toBe(hex);
    expect(() => assertRoundTrip(hex)).not.toThrow();
  });

  it('re-emits a Babbage map output as a map, keeping its datum and script ref', () => {
    // A map output carrying a multiasset value (1), an inline datum (2) and a script ref (3).
    const raw = new Map<number, unknown>([
      [0, CES_ADDR],
      [
        1,
        [
          1_180_000n,
          new Map([[hexToBytes(POLICY), new Map([[hexToBytes(Buffer.from('tokenA').toString('hex')), 100_000_000n]])]]),
        ],
      ],
      [2, [1, new Tag(24, hexToBytes('d87980'))]],
      [3, new Tag(24, hexToBytes('820158200102'))],
    ]);
    const reencoded = encodeOutput(decodeOutput(raw));
    expect(reencoded).toBeInstanceOf(Map);
    expect(bytesToHex(encode(reencoded))).toBe(bytesToHex(encode(raw)));
  });

  it('normalises CBOR integers that decode as number', () => {
    expect(toBigInt(5)).toBe(5n);
    expect(toBigInt(5n)).toBe(5n);
    expect(toBigInt(undefined)).toBe(0n);
  });

  it('spells assets for --tx-out with a dot, unlike the concatenated UTxO form', () => {
    expect(unitToCliAsset(UNIT)).toBe(`${POLICY}.${Buffer.from('tokenA').toString('hex')}`);
    expect(unitToCliAsset(POLICY)).toBe(POLICY);
  });

  it('decodes a bech32 address to its raw payload', () => {
    expect(bytesToHex(decodeBech32Address('addr_test1vrxjplptj99jcw2a20sncdnen08r6s8ut2qf9m3svsr9qssy6kvq6'))).toBe(
      '60cd20fc2b914b2c395d53e13c36799bce3d40fc5a8092ee3064065042'
    );
  });

  it('writes pre-encoded bytes verbatim, even when cbor2 would encode them differently', () => {
    const odd = Uint8Array.from([0x82, 0x18, 0x05, 0x01]); // [5, 1] with 5 in two bytes
    expect(bytesToHex(encode([new RawCbor(odd)]))).toBe('81821805' + '01');
  });
});

describe('offer envelope', () => {
  it('carries the sub-transaction verbatim under tag 24', () => {
    const { bytes } = nonCanonicalOffer();
    const envelope = encodeEnvelope(bytes);
    // [1, 7, 24(bytes)]: d818 is tag 24's head.
    expect(bytesToHex(envelope).startsWith('8301' + '07' + 'd818')).toBe(true);
    expect(bytesToHex(decodeEnvelope(envelope))).toBe(bytesToHex(bytes));
  });

  it('refuses an envelope version or era it does not know', () => {
    const bytes = offer().bytes;
    expect(() => decodeEnvelope(encode([2, 7, new Tag(24, bytes)]))).toThrow(/Unsupported envelope version/);
    expect(() => decodeEnvelope(encode([1, 6, new Tag(24, bytes)]))).toThrow(/Unsupported era tag/);
  });
});

describe('offer', () => {
  it("signs its own body hash with the caller's key, not any batch", () => {
    const sub = offer();
    const [, wits] = sub.items as [unknown, Map<number, unknown>, unknown];
    const [[vkey, signature]] = asArray(wits.get(0)) as Uint8Array[][];
    expect(ed25519.verify(signature, hashBody(sub.body), vkey)).toBe(true);
    expect(bytesToHex(vkey)).toBe(bytesToHex(ed25519.getPublicKey(CALLER_KEY)));
    expect(sub.bodyHash).toBe(bytesToHex(hashBody(sub.body)));
  });

  it('carries no fee or collateral field, so it cannot balance alone', () => {
    const sub = offer();
    for (const forbidden of [2, 13, 16, 17]) {
      expect(sub.body.has(forbidden)).toBe(false);
    }
  });

  it('offers exactly the price in tokens and needs exactly the change lovelace', () => {
    const delta = imbalance(offer(), resolve);
    expect(delta.assets.get(UNIT)).toBe(PRICE_AMOUNT);
    expect(delta.lovelace).toBe(-CHANGE_LOVELACE);
  });

  it('hashes an arriving offer as it was encoded, not as cbor2 would re-encode it', () => {
    const { bytes, bodyBytes } = nonCanonicalOffer();
    const sub = decodeSubTransactionBytes(bytes);
    expect(sub.bodyHash).toBe(bytesToHex(blake2b(bodyBytes, { dkLen: 32 })));
    expect(() => verifyWitnesses(sub)).not.toThrow();
    // A plain decode forgets the encoding, so re-encoding produces a different hash and a
    // signature that no longer verifies.
    const reencoded = decodeSubTransaction(decode(bytes) as unknown[]);
    expect(reencoded.bodyHash).not.toBe(sub.bodyHash);
    expect(() => verifyWitnesses(reencoded)).toThrow(/does not verify/);
  });

  it('refuses an offer with no witnesses', () => {
    const sub = decodeSubTransactionBytes(encode([offerBody(), new Map(), null]));
    expect(() => verifyWitnesses(sub)).toThrow(/no vkey witnesses/);
  });

  it('gives a token-bearing output more than a bare ada one', () => {
    const bare = minUtxoLovelace({ address: CES_ADDR, value: { lovelace: 0n, assets: new Map() } }, UTXO_COST_PER_BYTE);
    const withToken = minUtxoLovelace(
      { address: CES_ADDR, value: { lovelace: 0n, assets: new Map([[UNIT, 1n]]) } },
      UTXO_COST_PER_BYTE
    );
    expect(withToken).toBeGreaterThan(bare);
  });
});

describe('receiveOffer (stateless checks)', () => {
  it('accepts a well-formed offer and names who signed it', () => {
    const sub = offer();
    const { sub: received, signers } = receiveOffer(envelopeOf(sub));
    expect(received.bodyHash).toBe(sub.bodyHash);
    expect(signers).toEqual([bytesToHex(ed25519.getPublicKey(CALLER_KEY))]);
  });

  it('refuses bytes that are not an envelope as malformed', () => {
    expect(rejection(() => receiveOffer('deadbeef')).code).toBe('malformed');
  });

  it('refuses an envelope version it does not know as unsupported-version', () => {
    const hex = bytesToHex(encode([2, 7, new Tag(24, offer().bytes)]));
    expect(rejection(() => receiveOffer(hex)).code).toBe('unsupported-version');
  });

  it('refuses a witness that does not sign the body it arrived with', () => {
    const signed = offer();
    const tampered = encode([offerBody(1n), signed.items[1], null]);
    const err = rejection(() => receiveOffer(bytesToHex(encodeEnvelope(tampered))));
    expect(err.code).toBe('malformed');
    expect(err.message).toMatch(/does not verify/);
  });

  const REWARD_ACCOUNT = new Uint8Array(29).fill(4);
  const CREDENTIAL = [0, new Uint8Array(28).fill(3)];

  it.each([
    [4, 'certificates', []],
    [5, 'withdrawals', new Map()],
    [9, 'mint', new Map()],
    [14, 'guards', asSet([new Uint8Array(28).fill(3)])],
    [23, 'nested sub-transactions', asSet([offer().items])],
    // The three below are what `sub_transaction_body` actually permits and `computeBalance`
    // cannot see: 22 and 25 move lovelace without touching an output, and 24 constrains the
    // batch that carries the offer.
    [22, 'a treasury donation', 1_000_000n],
    [24, 'required top-level guards', new Map([[CREDENTIAL, null]])],
    [25, 'direct deposits', new Map([[REWARD_ACCOUNT, 1_000_000n]])],
    [26, 'account balance intervals', new Map([[REWARD_ACCOUNT, [0n, null]]])],
  ])('is not interested in an offer carrying body key %i (%s)', (key, label, value) => {
    const body = offerBody();
    body.set(key as number, value);
    const err = rejection(() => receiveOffer(envelopeOf(offer(body))));
    expect(err.code).toBe('not-interested');
    expect(err.message).toContain(String(label));
  });

  it.each([
    [3, 'a time-to-live'],
    [8, 'a validity interval start'],
  ])('accepts an offer bounded by body key %i (%s), which is how an offer expires', (key) => {
    const body = offerBody();
    body.set(key, 100n);
    expect(() => receiveOffer(envelopeOf(offer(body)))).not.toThrow();
  });
});

describe('verifyOffer (chain-state checks)', () => {
  it('accepts an offer that pays the quote for what it needs', () => {
    const sub = offer();
    const verified = verifyOffer(sub, lookup, QUOTE, PP);
    expect(verified.lovelaceNeeded).toBe(CHANGE_LOVELACE);
    expect(verified.offered.get(UNIT)).toBe(PRICE_AMOUNT);
    expect(verified.feeShare).toBe(offerFee(sub.bytes.length, TX_FEE_FIXED, TX_FEE_PER_BYTE));
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
    const body = buildOfferBody(
      [CES_IN],
      [{ address: CALLER_ADDR, value: { lovelace: 1_000_000n, assets: new Map() } }]
    );
    const err = rejection(() => verifyOffer(offer(body), lookup, QUOTE, PP, [CES_IN]));
    expect(err.message).toMatch(/belongs to this service/);
  });

  it('is not interested in an offer that needs tokens from its batch', () => {
    const body = buildOfferBody(
      [CALLER_IN],
      [{ address: RECIPIENT_ADDR, value: { lovelace: CALLER_LOVELACE, assets: new Map([[UNIT, HELD + 1n]]) } }]
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
    expect(result.parent.body.get(BODY_SUB_TRANSACTIONS)).toBeInstanceOf(Tag);
    expect(result.fee).toBe(minFeeFor(result.signedSizeBytes, TX_FEE_FIXED, TX_FEE_PER_BYTE));
    // The exchange paid the fee out of its own change.
    const change = decodeOutput(asArray(result.parent.body.get(BODY_OUTPUTS))[0]);
    expect(change.value.lovelace).toBe(resolve(CES_IN).lovelace - CHANGE_LOVELACE - result.fee);
    expect(change.value.assets.get(UNIT)).toBe(PRICE_AMOUNT);
  });

  it('encodes sub_transactions as a CBOR set, as the ledger requires', () => {
    // Tag 258 is the set wrapper; d9 0102 is its CBOR head. The CDDL has
    // `sub_transactions = nonempty_oset<sub_transaction>`: a list on the wire, even though the
    // ledger holds it in memory as a map keyed by TxId.
    expect(encodeTx(assemble([offer()]).parent)).toContain('17d9010281');
  });

  it('inserts the offer verbatim, so a signature over an unusual encoding survives', () => {
    const { bytes } = nonCanonicalOffer();
    const sub = decodeSubTransactionBytes(bytes);
    expect(encodeTx(assemble([sub]).parent)).toContain(bytesToHex(bytes));
  });

  it("declares the offer's inputs as reference inputs so the node resolves them", () => {
    const result = assemble([offer()]);
    const refs = asArray(result.parent.body.get(BODY_REFERENCE_INPUTS)).map(decodeInput);
    expect(refs).toEqual([CALLER_IN]);
    expect(result.declaredReferenceInputs).toEqual([CALLER_IN]);
  });

  it('counts the bytes a vkey witness really adds, so the fee covers the signed size', () => {
    // Measured against cbor2 rather than assumed: an under-count here silently produces a
    // batch the node rejects for too low a fee.
    const witness = [new Uint8Array(32).fill(1), new Uint8Array(64).fill(2)];
    const size = (n: number) => {
      const wits = n === 0 ? new Map() : new Map([[0, asSet(Array.from({ length: n }, () => witness))]]);
      return encode([cesDraft().body, wits, null]).length;
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
    small.set(`${CES_IN.txHash}#0`, { lovelace: 1_500_000n, assets: new Map() });
    const res = (i: { txHash: string; index: number }) => small.get(`${i.txHash}#${i.index}`)!;
    expect(() => assemble([offer()], cesDraft(1_500_000n), res)).toThrow(/below its .* minimum/);
  });
});

describe('deductPrice', () => {
  it("takes the price out of the caller's change, not the recipient's output", () => {
    const outputs = [
      { address: RECIPIENT_ADDR, value: { lovelace: 1_180_000n, assets: new Map([[UNIT, SENT]]) } },
      { address: CALLER_ADDR, value: { lovelace: CHANGE_LOVELACE, assets: new Map([[UNIT, CHANGE_TOKENS]]) } },
    ];
    const { outputs: updated, index } = deductPrice(outputs, PRICE, CALLER_ADDR);
    expect(index).toBe(1);
    expect(updated[1].value.assets.get(UNIT)).toBe(CHANGE_TOKENS - PRICE_AMOUNT);
    // The person being paid is untouched.
    expect(updated[0].value.assets.get(UNIT)).toBe(SENT);
  });

  it("refuses rather than billing the recipient when the caller's change cannot cover the price", () => {
    const outputs = [
      { address: RECIPIENT_ADDR, value: { lovelace: 1_180_000n, assets: new Map([[UNIT, 100_000_000n]]) } },
      { address: CALLER_ADDR, value: { lovelace: CHANGE_LOVELACE, assets: new Map([[UNIT, 1n]]) } },
    ];
    expect(() => deductPrice(outputs, PRICE, CALLER_ADDR)).toThrow(/belongs to someone else/);
  });

  it('refuses when no output holds enough of the payment asset', () => {
    const outputs = [{ address: CALLER_ADDR, value: { lovelace: 1_180_000n, assets: new Map() } }];
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
