import { describe, expect, it } from 'vitest';
import { blake2b } from '@noble/hashes/blake2.js';
import { ed25519 } from '@noble/curves/ed25519.js';
import { parseEnvelope, parseSubTransaction, serializeEnvelope } from '@capacity-exchange/cardano-core';
import { Cardano, Serialization } from '@cardano-sdk/core';
import { HexBlob } from '@cardano-sdk/util';
import {
  bytesToHex,
  cborSize,
  hexToBytes,
  inputRef,
  makeInput,
  makeOutput,
  outputValue,
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
import { deductPrice, vkeyWitnessBytes } from './fees.js';
import { signingKeyPath, walletDir } from '../commands/state.js';
import { unitToCliAsset } from '../cardano/value.js';
import type { Value } from '../cardano/value.js';

const POLICY = '7a3f9c2e4b81d05f6a92c7e310bd48f2c95a6e07d31b8f4a2c6e9053';
const UNIT = `${POLICY}${Buffer.from('tokenA').toString('hex')}`;
const CALLER_IN = makeInput('a1'.repeat(32), 0);
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
const CALLER_KEY = new Uint8Array(32).fill(7);
const UTXO_COST_PER_BYTE = 4310n;

const chain = new Map<string, Value>([
  [inputRef(CALLER_IN), { lovelace: CALLER_LOVELACE, assets: new Map([[UNIT, HELD]]) }],
]);
const resolve = (i: TxInput): Value => chain.get(inputRef(i)) ?? { lovelace: 0n, assets: new Map() };

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
/** An envelope around arbitrary sub-transaction bytes, for offers the SDK would refuse to build. */
/** The offer body with one more map entry, written as raw CBOR, appended. */
/**
 * What `build-raw` gives the exchange: its funding input, and a change output that already
 * gives up the lovelace the offer needs and takes in the tokens it pays, at a fee of zero.
 */
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

describe('codec', () => {
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

describe('fees', () => {
  it('counts the bytes a vkey witness really adds, so the fee covers the signed size', () => {
    // Measured rather than assumed: an under-count here silently produces an offer whose
    // fee share is short.
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
      return cborSize(new SubTransaction(offerBody(), wits).toCbor());
    };
    const unwitnessed = size(0);
    expect(vkeyWitnessBytes(0)).toBe(0);
    for (const n of [1, 2, 3, 5]) {
      expect(vkeyWitnessBytes(n)).toBe(size(n) - unwitnessed);
    }
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
