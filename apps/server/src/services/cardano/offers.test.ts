import { describe, expect, it } from 'vitest';
import pino from 'pino';
import {
  asArray,
  BODY_REFERENCE_INPUTS,
  BODY_SUB_TRANSACTIONS,
  buildOfferBody,
  bytesToHex,
  computeBalance,
  type DecodedTx,
  decodeInput,
  encodeEnvelope,
  enterpriseAddress,
  paymentKey,
  readInputs,
  readOutputs,
  signSubTransaction,
  type TxInput,
  type TxOutput,
  BODY_INPUTS,
  BODY_OUTPUTS,
  BODY_FEE,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import { CardanoOfferService, lovelaceNeeded, OfferRejected, receiveOffer } from './offers.js';
import { type CardanoWalletService, utxoRef, type WalletUtxo } from './wallet.js';

const PARAMS = { txFeeFixed: 155_381n, txFeePerByte: 44n, utxoCostPerByte: 4310n };
const SERVER = paymentKey(new Uint8Array(32).fill(1));
const CALLER = paymentKey(new Uint8Array(32).fill(2));
const SERVER_ADDR = enterpriseAddress(SERVER.keyHash, 0);
const CALLER_ADDR = enterpriseAddress(CALLER.keyHash, 0);
const CALLER_IN = { txHash: 'c1'.repeat(32), index: 0 };
const SERVER_IN = { txHash: '5e'.repeat(32), index: 1 };
const TOKEN = `${'7a'.repeat(28)}${Buffer.from('tok').toString('hex')}`;

const ada = (lovelace: bigint) => ({ lovelace, assets: new Map<string, bigint>() });

/** A caller holding 3 ADA who wants 4 ADA out: the offer needs 1 ADA from its batch. */
function offerEnvelope(outLovelace = 4_000_000n, input = CALLER_IN): string {
  const body = buildOfferBody([input], [{ address: CALLER_ADDR, value: ada(outLovelace) }]);
  return bytesToHex(encodeEnvelope(signSubTransaction(body, CALLER.signingKey).bytes));
}

function fakeWallet(chain: Map<string, TxOutput>, own: WalletUtxo[]) {
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

function defaultChain(): Map<string, TxOutput> {
  return new Map([
    [utxoRef(CALLER_IN), { address: CALLER_ADDR, value: ada(3_000_000n) }],
    [utxoRef(SERVER_IN), { address: SERVER_ADDR, value: ada(20_000_000n) }],
  ]);
}

const OWN: WalletUtxo[] = [
  { input: SERVER_IN, output: { address: SERVER_ADDR, value: ada(20_000_000n) } },
];

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

describe('receiveOffer', () => {
  it('accepts a signed sub-transaction and keys it by its body hash', () => {
    const sub = receiveOffer(offerEnvelope());
    expect(sub.inputs).toEqual([CALLER_IN]);
    expect(sub.bodyHash).toHaveLength(64);
  });

  it('refuses bytes that are not an envelope as malformed', () => {
    expect(rejection(() => receiveOffer('deadbeef')).code).toBe('malformed');
  });
});

describe('lovelaceNeeded', () => {
  const sub = () => receiveOffer(offerEnvelope());

  it('is what the outputs carry beyond the inputs', () => {
    expect(lovelaceNeeded(sub(), defaultChain(), SERVER_ADDR)).toBe(1_000_000n);
  });

  it('marks an offer whose input is not unspent as invalidated', () => {
    expect(rejection(() => lovelaceNeeded(sub(), new Map(), SERVER_ADDR)).code).toBe('invalidated');
  });

  it('is not interested in an offer that moves tokens', () => {
    const chain = defaultChain();
    chain.set(utxoRef(CALLER_IN), {
      address: CALLER_ADDR,
      value: { lovelace: 3_000_000n, assets: new Map([[TOKEN, 5n]]) },
    });
    expect(rejection(() => lovelaceNeeded(sub(), chain, SERVER_ADDR)).code).toBe('not-interested');
  });

  it("is not interested in an offer that spends the server's own UTxO", () => {
    const own = receiveOffer(offerEnvelope(4_000_000n, SERVER_IN));
    expect(rejection(() => lovelaceNeeded(own, defaultChain(), SERVER_ADDR)).code).toBe(
      'not-interested',
    );
  });

  it('refuses an offer that needs more than the per-offer limit as over-budget', () => {
    const greedy = receiveOffer(offerEnvelope(9_000_000n));
    expect(rejection(() => lovelaceNeeded(greedy, defaultChain(), SERVER_ADDR)).code).toBe(
      'over-budget',
    );
  });
});

describe('CardanoOfferService', () => {
  const logger = pino({ level: 'silent' }) as never;

  async function carried() {
    const { wallet, submitted } = fakeWallet(defaultChain(), OWN);
    const service = new CardanoOfferService(wallet, logger);
    const { offerId } = service.submit(offerEnvelope());
    await service.idle();
    return { service, offerId, batch: submitted[0] };
  }

  it('submits a batch carrying the offer and reports its id', async () => {
    const { service, offerId } = await carried();
    expect(service.status(offerId)).toEqual({
      offerId,
      state: 'submitted',
      batchTxId: 'ba'.repeat(32),
    });
  });

  it('builds a batch that balances only with the offer counted in', async () => {
    const { batch } = await carried();
    const [sub] = asArray(batch.body.get(BODY_SUB_TRANSACTIONS));
    expect(sub).toBeDefined();
    const chain = defaultChain();
    const offer = receiveOffer(offerEnvelope());
    const balance = computeBalance(
      readInputs(batch.body, BODY_INPUTS),
      readOutputs(batch.body, BODY_OUTPUTS),
      [offer],
      batch.body.get(BODY_FEE) as bigint,
      (i) => chain.get(utxoRef(i))!.value,
    );
    expect(balance.balances).toBe(true);
    expect(readOutputs(batch.body, BODY_OUTPUTS)[0].value.lovelace).toBe(
      20_000_000n - 1_000_000n - (batch.body.get(BODY_FEE) as bigint),
    );
  });

  it("lists the offer's input as a reference input, so the node resolves it", async () => {
    const { batch } = await carried();
    expect(asArray(batch.body.get(BODY_REFERENCE_INPUTS)).map(decodeInput)).toEqual([CALLER_IN]);
  });

  it('refuses the same offer twice', async () => {
    const { service } = await carried();
    expect(rejection(() => service.submit(offerEnvelope())).code).toBe('duplicate');
  });

  it('rejects an offer it cannot fund as busy', async () => {
    const { wallet } = fakeWallet(defaultChain(), []);
    const service = new CardanoOfferService(wallet, logger);
    const { offerId } = service.submit(offerEnvelope());
    await service.idle();
    expect(service.status(offerId)?.state).toBe('rejected');
    expect(service.status(offerId)?.reason?.code).toBe('busy');
  });
});
