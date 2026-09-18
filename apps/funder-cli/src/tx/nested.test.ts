import { describe, expect, it } from 'vitest';
import { encode, Tag } from 'cbor2';
import { ed25519 } from '@noble/curves/ed25519.js';
import {
  asArray,
  asSet,
  assertRoundTrip,
  BODY_FEE,
  BODY_INPUTS,
  BODY_OUTPUTS,
  BODY_SUB_TRANSACTIONS,
  bytesToHex,
  type CborMap,
  decodeTx,
  encodeInput,
  encodeOutput,
  encodeTx,
  hexToBytes,
  toBigInt,
} from './codec.js';
import { buildSubTransaction, hashBody, minUtxoLovelace } from './subtx.js';
import { deductPrice, spliceOffer, verifyOffer } from './splice.js';
import { decodeBech32Address } from '../ces/simulate.js';
import { assertExactlyOneMode } from '../commands/offer.js';
import { unitToCliAsset } from '../cardano/value.js';
import type { Value } from '../cardano/value.js';

const POLICY = '7a3f9c2e4b81d05f6a92c7e310bd48f2c95a6e07d31b8f4a2c6e9053';
const UNIT = `${POLICY}${Buffer.from('tokenA').toString('hex')}`;
const CALLER_IN = { txHash: 'a1'.repeat(32), index: 0 };
const CES_IN = { txHash: '3f'.repeat(32), index: 0 };
const ADDR = hexToBytes('60cd20fc2b914b2c395d53e13c36799bce3d40fc5a8092ee3064065042');
const SIGNING_KEY = new Uint8Array(32).fill(7);
const UTXO_COST_PER_BYTE = 4310n;
const TX_FEE_FIXED = 155_381n;
const TX_FEE_PER_BYTE = 44n;

const chain = new Map<string, Value>([
  [`${CALLER_IN.txHash}#0`, { lovelace: 1_180_000n, assets: new Map([[UNIT, 100_000_000n]]) }],
  [`${CES_IN.txHash}#0`, { lovelace: 12_400_000n, assets: new Map() }],
]);
const resolve = (i: { txHash: string; index: number }): Value =>
  chain.get(`${i.txHash}#${i.index}`) ?? { lovelace: 0n, assets: new Map() };

function parentDraft() {
  const body: CborMap = new Map<number, unknown>([
    [BODY_INPUTS, asSet([encodeInput(CALLER_IN)])],
    [
      BODY_OUTPUTS,
      [encodeOutput({ address: ADDR, value: { lovelace: 1_180_000n, assets: new Map([[UNIT, 100_000_000n]]) } })],
    ],
    [BODY_FEE, 0n],
  ]);
  return { items: [body, new Map(), null], body };
}

function offer(released = 181_381n, price = new Map([[UNIT, 1_001_995n]])) {
  return buildSubTransaction({
    input: CES_IN,
    inputValue: resolve(CES_IN),
    address: ADDR,
    price,
    released,
    utxoCostPerByte: UTXO_COST_PER_BYTE,
    signingKey: SIGNING_KEY,
  });
}

describe('codec', () => {
  it('round-trips a transaction byte for byte', () => {
    const hex = encodeTx(parentDraft());
    expect(encodeTx(decodeTx(hex))).toBe(hex);
    expect(() => assertRoundTrip(hex)).not.toThrow();
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
});

describe('sub-transaction', () => {
  it('signs its own body hash, not the parent transaction', () => {
    const sub = offer();
    const [, wits] = sub.items as [unknown, Map<number, unknown>, unknown];
    // Freshly built witnesses are a Tag(258); only decoding turns one into a Set.
    const [[vkey, signature]] = asArray(wits.get(0)) as Uint8Array[][];
    expect(ed25519.verify(signature, hashBody(sub.body), vkey)).toBe(true);
    expect(bytesToHex(vkey)).toBe(bytesToHex(ed25519.getPublicKey(SIGNING_KEY)));
  });

  it('carries no fee or collateral field, so it cannot balance alone', () => {
    const sub = offer();
    for (const forbidden of [2, 13, 16, 17]) {
      expect(sub.body.has(forbidden)).toBe(false);
    }
  });

  it('releases exactly the lovelace it was asked to', () => {
    const sub = offer(181_381n);
    const produced = sub.outputs.reduce((total, o) => total + o.value.lovelace, 0n);
    expect(resolve(CES_IN).lovelace - produced).toBe(181_381n);
  });

  it('refuses to build when the exchange UTxO is too small', () => {
    expect(() =>
      buildSubTransaction({
        input: CES_IN,
        inputValue: { lovelace: 1_200_000n, assets: new Map() },
        address: ADDR,
        price: new Map([[UNIT, 1n]]),
        released: 181_381n,
        utxoCostPerByte: UTXO_COST_PER_BYTE,
        signingKey: SIGNING_KEY,
      })
    ).toThrow(/too small/);
  });

  it('gives a token-bearing output more than a bare ada one', () => {
    const bare = minUtxoLovelace({ address: ADDR, value: { lovelace: 0n, assets: new Map() } }, UTXO_COST_PER_BYTE);
    const withToken = minUtxoLovelace(
      { address: ADDR, value: { lovelace: 0n, assets: new Map([[UNIT, 1n]]) } },
      UTXO_COST_PER_BYTE
    );
    expect(withToken).toBeGreaterThan(bare);
  });
});

describe('verifyOffer', () => {
  const price = new Map([[UNIT, 1_001_995n]]);

  it('accepts a well-formed offer', () => {
    const result = verifyOffer(offer(), price, [CALLER_IN], resolve);
    expect(result.released).toBe(181_381n);
  });

  it('rejects an offer that takes more than the quoted price', () => {
    const greedy = offer(181_381n, new Map([[UNIT, 2_000_000n]]));
    expect(() => verifyOffer(greedy, price, [CALLER_IN], resolve)).toThrow(/quoted price/);
  });

  it("rejects an offer that spends the caller's own UTxO", () => {
    const sub = offer();
    sub.inputs = [CALLER_IN];
    expect(() => verifyOffer(sub, price, [CALLER_IN], resolve)).toThrow(/caller's own UTxO/);
  });

  it('rejects an offer that does anything but move value', () => {
    const sub = offer();
    sub.body.set(5, new Map()); // withdrawals
    expect(() => verifyOffer(sub, price, [CALLER_IN], resolve)).toThrow(/withdrawals/);
  });
});

describe('splice', () => {
  const price = new Map([[UNIT, 1_001_995n]]);

  it('produces a balanced bundle with the sub-transaction at key 23', () => {
    const result = spliceOffer({
      parent: parentDraft(),
      sub: offer(),
      price,
      resolve,
      txFeeFixed: TX_FEE_FIXED,
      txFeePerByte: TX_FEE_PER_BYTE,
      witnessCount: 1,
    });
    expect(result.balance.balances).toBe(true);
    expect(result.fee).toBe(181_381n);
    expect(result.parent.body.get(BODY_SUB_TRANSACTIONS)).toBeInstanceOf(Tag);
    expect(result.surplus).toBeGreaterThanOrEqual(0n);
  });

  it('encodes sub_transactions as a CBOR set, as the ledger requires', () => {
    const result = spliceOffer({
      parent: parentDraft(),
      sub: offer(),
      price,
      resolve,
      txFeeFixed: TX_FEE_FIXED,
      txFeePerByte: TX_FEE_PER_BYTE,
      witnessCount: 1,
    });
    // Tag 258 is the set wrapper; d9 0102 is its CBOR head.
    expect(encodeTx(result.parent)).toContain('17d9010281');
  });

  it('refuses when the exchange under-pads and the fee falls short', () => {
    expect(() =>
      spliceOffer({
        parent: parentDraft(),
        sub: offer(1000n),
        price,
        resolve,
        txFeeFixed: TX_FEE_FIXED,
        txFeePerByte: TX_FEE_PER_BYTE,
        witnessCount: 1,
      })
    ).toThrow(/below the .* minimum/);
  });

  it('takes the price out of an output that holds the asset', () => {
    const outputs = [{ address: ADDR, value: { lovelace: 1_180_000n, assets: new Map([[UNIT, 100_000_000n]]) } }];
    const { outputs: updated, index } = deductPrice(outputs, price);
    expect(index).toBe(0);
    expect(updated[0].value.assets.get(UNIT)).toBe(98_998_005n);
  });

  it('refuses when no output holds enough of the payment asset', () => {
    const outputs = [{ address: ADDR, value: { lovelace: 1_180_000n, assets: new Map() } }];
    expect(() => deductPrice(outputs, price)).toThrow(/No parent output/);
  });
});

describe('offer mode', () => {
  it('requires exactly one mode, so a run can never silently simulate', () => {
    expect(() => assertExactlyOneMode({})).toThrow(/exactly one/);
    expect(() => assertExactlyOneMode({ simulateCes: true, cesUrl: 'https://x' })).toThrow(/exactly one/);
    expect(() => assertExactlyOneMode({ simulateCes: true })).not.toThrow();
    expect(() => assertExactlyOneMode({ cesUrl: 'https://x' })).not.toThrow();
  });
});
