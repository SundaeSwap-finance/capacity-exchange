import { describe, expect, it } from 'vitest';
import pino from 'pino';
import {
  asArray,
  BODY_FEE,
  BODY_INPUTS,
  BODY_OUTPUTS,
  BODY_REFERENCE_INPUTS,
  BODY_SUB_TRANSACTIONS,
  buildOfferBody,
  bytesToHex,
  computeBalance,
  type DecodedTx,
  decodeInput,
  encodeEnvelope,
  enterpriseAddress,
  OfferRejected,
  paymentKey,
  readInputs,
  readOutputs,
  receiveOffer,
  signSubTransaction,
  type TxInput,
  type TxOutput,
  type Value,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import type { Quote } from '../quote.js';
import { CardanoOfferService, quoteTerms } from './offers.js';
import { type CardanoWalletService, selectFunding, utxoRef, type WalletUtxo } from './wallet.js';

const PARAMS = { txFeeFixed: 155_381n, txFeePerByte: 44n, utxoCostPerByte: 4310n };
const SERVER = paymentKey(new Uint8Array(32).fill(1));
const CALLER = paymentKey(new Uint8Array(32).fill(2));
const SERVER_ADDR = enterpriseAddress(SERVER.keyHash, 0);
const CALLER_ADDR = enterpriseAddress(CALLER.keyHash, 0);
const ORDER_ADDR = Uint8Array.from([0x70, ...new Uint8Array(28).fill(9)]);
const CALLER_IN = { txHash: 'c1'.repeat(32), index: 0 };
const SERVER_IN = { txHash: '5e'.repeat(32), index: 1 };
const TOKEN = `${'7a'.repeat(28)}${Buffer.from('tok').toString('hex')}`;
const PRICE = 100n;

const value = (lovelace: bigint, tokens = 0n): Value => ({
  lovelace,
  assets: tokens ? new Map([[TOKEN, tokens]]) : new Map(),
});

function quote(amount = 6_000_000n, price = PRICE): Quote {
  return {
    currency: 'ADA',
    amount,
    prices: [
      {
        amount: price.toString(),
        currency: { id: `cardano:native:${TOKEN}`, type: 'cardano:native', rawId: TOKEN },
      },
    ],
  };
}

/**
 * The caller holds 1.5 ADA and 1000 tokens. They place 600 tokens and 5 ADA at an order script,
 * keep 300, and leave 100 as the price: the offer needs 5 ADA from its batch.
 */
function offerEnvelope(input = CALLER_IN, orderTokens = 600n): string {
  const body = buildOfferBody(
    [input],
    [
      { address: ORDER_ADDR, value: value(5_000_000n, orderTokens) },
      { address: CALLER_ADDR, value: value(1_500_000n, 300n) },
    ],
  );
  return bytesToHex(encodeEnvelope(signSubTransaction(body, CALLER.signingKey).bytes));
}

function defaultChain(): Map<string, TxOutput> {
  return new Map([
    [utxoRef(CALLER_IN), { address: CALLER_ADDR, value: value(1_500_000n, 1000n) }],
    [utxoRef(SERVER_IN), { address: SERVER_ADDR, value: value(20_000_000n) }],
  ]);
}

const OWN: WalletUtxo[] = [
  { input: SERVER_IN, output: { address: SERVER_ADDR, value: value(20_000_000n) } },
];

function fakeWallet(chain = defaultChain(), own = OWN) {
  const submitted: DecodedTx[] = [];
  const wallet = {
    address: SERVER_ADDR,
    resolve: async (inputs: TxInput[]) =>
      new Map(
        inputs.flatMap((i) =>
          chain.has(utxoRef(i)) ? [[utxoRef(i), chain.get(utxoRef(i))!]] : [],
        ),
      ),
    utxos: async () => own,
    feeParams: async () => PARAMS,
    signAndSubmit: async (tx: DecodedTx) => {
      submitted.push(tx);
      return 'ba'.repeat(32);
    },
  };
  return { wallet: wallet as unknown as CardanoWalletService, submitted };
}

const logger = pino({ level: 'silent' }) as never;

async function carry(envelope = offerEnvelope(), q = quote(), chain = defaultChain(), own = OWN) {
  const { wallet, submitted } = fakeWallet(chain, own);
  const service = new CardanoOfferService(wallet, logger);
  const { offerId } = service.submit(envelope, q);
  await service.idle();
  return { service, offerId, status: service.status(offerId)!, batch: submitted[0] };
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

describe('quoteTerms', () => {
  it('takes the quoted price in the token the offer leaves behind', () => {
    expect(quoteTerms(quote(), value(-5_000_000n, PRICE))).toEqual({
      capacity: 6_000_000n,
      priceUnit: TOKEN,
      priceAmount: PRICE,
    });
  });

  it('is not interested in an offer that leaves less than every quoted price', () => {
    expect(rejection(() => quoteTerms(quote(), value(-5_000_000n, PRICE - 1n))).code).toBe(
      'not-interested',
    );
  });
});

describe('CardanoOfferService', () => {
  it('submits a batch carrying the offer and reports its id', async () => {
    const { offerId, status } = await carry();
    expect(status).toEqual({ offerId, state: 'submitted', batchTxId: 'ba'.repeat(32) });
  });

  it('balances the batch, taking the price in tokens and giving the ADA the offer needs', async () => {
    const { batch } = await carry();
    expect(asArray(batch.body.get(BODY_SUB_TRANSACTIONS))).toHaveLength(1);
    const chain = defaultChain();
    const fee = batch.body.get(BODY_FEE) as bigint;
    const balance = computeBalance(
      readInputs(batch.body, BODY_INPUTS),
      readOutputs(batch.body, BODY_OUTPUTS),
      [receiveOffer(offerEnvelope()).sub],
      fee,
      (i) => chain.get(utxoRef(i))!.value,
    );
    expect(balance.balances).toBe(true);
    const [change] = readOutputs(batch.body, BODY_OUTPUTS);
    expect(change.value).toEqual(value(20_000_000n - 5_000_000n - fee, PRICE));
  });

  it("lists the offer's input as a reference input, so the node resolves it", async () => {
    const { batch } = await carry();
    expect(asArray(batch.body.get(BODY_REFERENCE_INPUTS)).map(decodeInput)).toEqual([CALLER_IN]);
  });

  it('is not interested in an offer that pays less than the quote', async () => {
    const { status } = await carry(offerEnvelope(CALLER_IN, 601n));
    expect(status.reason?.code).toBe('not-interested');
  });

  it('is not interested in an offer needing more ADA, with its fee share, than was quoted', async () => {
    const { status } = await carry(offerEnvelope(), quote(5_000_000n));
    expect(status.reason).toMatchObject({ code: 'not-interested', message: /fee share/ });
  });

  it('marks an offer whose input is not unspent as invalidated', async () => {
    const { status } = await carry(offerEnvelope(), quote(), new Map());
    expect(status.reason?.code).toBe('invalidated');
  });

  it("is not interested in an offer that spends the server's own UTxO", async () => {
    const chain = defaultChain();
    chain.set(utxoRef(SERVER_IN), { address: SERVER_ADDR, value: value(1_500_000n, 1000n) });
    const { status } = await carry(offerEnvelope(SERVER_IN), quote(), chain);
    expect(status.reason?.message).toMatch(/belongs to this service/);
  });

  it('rejects an offer it cannot fund as busy', async () => {
    const { status } = await carry(offerEnvelope(), quote(), defaultChain(), []);
    expect(status.reason?.code).toBe('busy');
  });

  it('refuses an offer it already holds, but takes a refused one again', async () => {
    const { wallet } = fakeWallet(defaultChain(), []);
    const service = new CardanoOfferService(wallet, logger);
    service.submit(offerEnvelope(), quote());
    expect(rejection(() => service.submit(offerEnvelope(), quote())).code).toBe('duplicate');
    await service.idle();
    expect(service.submit(offerEnvelope(), quote()).state).toBe('received');
  });
});

describe('selectFunding', () => {
  const utxo = (index: number, lovelace: bigint, rest?: unknown): WalletUtxo => ({
    input: { txHash: '5e'.repeat(32), index },
    output: { address: SERVER_ADDR, value: value(lovelace, index === 1 ? 5n : 0n), rest },
  });

  it('takes the largest UTxOs first, token-bearing ones included', () => {
    const picked = selectFunding([utxo(0, 3_000_000n), utxo(1, 9_000_000n)], 5_000_000n);
    expect(picked.map((u) => u.input.index)).toEqual([1]);
  });

  it('leaves a UTxO carrying a datum alone', () => {
    const withDatum = utxo(
      2,
      50_000_000n,
      new Map<number, unknown>([[2, [0, new Uint8Array(32)]]]),
    );
    const picked = selectFunding([withDatum, utxo(0, 9_000_000n)], 5_000_000n);
    expect(picked.map((u) => u.input.index)).toEqual([0]);
  });

  it('refuses when the spendable UTxOs fall short', () => {
    expect(() => selectFunding([utxo(0, 3_000_000n)], 5_000_000n)).toThrow(/needs/);
  });
});
