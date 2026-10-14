import { describe, it, expect, beforeAll } from 'vitest';
import pino from 'pino';
import { randomBytes } from 'crypto';
import { encode, Tag } from 'cbor2';
import {
  buildOfferBody,
  bytesToHex,
  encodeEnvelope,
  hexToBytes,
  signSubTransaction,
  type TxInput,
  type TxOutput,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import { CardanoChainStateService } from '../cardano-chain-state.js';
import { QuoteService } from '../quote.js';
import { CardanoWalletService } from './wallet.js';
import { CardanoOfferService } from './offers.js';

/**
 * Submits real transactions through a live UTxO RPC source such as Dolos, and is skipped
 * without one. The server key must hold at least 10 ADA; the caller key a UTxO of about 1.5 ADA
 * and at least 1000 of one native token, which it pays the server with:
 *   UTXORPC_LIVE_TEST_URL=http://127.0.0.1:50151 \
 *   CARDANO_LIVE_TEST_SKEY_FILE=<server payment.skey> \
 *   CARDANO_LIVE_TEST_CALLER_SKEY_FILE=<caller payment.skey> bunx vitest run wallet.live
 * Inclusion takes a few minutes on Musashi, so each test waits for its transaction on chain.
 */
const url = process.env.UTXORPC_LIVE_TEST_URL;
const skeyFile = process.env.CARDANO_LIVE_TEST_SKEY_FILE;
const callerSkeyFile = process.env.CARDANO_LIVE_TEST_CALLER_SKEY_FILE;
const INCLUSION_TIMEOUT_MS = 10 * 60_000;
const CALLER_FUNDS = 3_000_000n;

// The SundaeSwap v4 deployment of Musashi tx
// 5263b0a21471cd8a453dfc5fd6482d9ea95695dd8f8edfab293ad61b79455d8f, which placed a swap order.
const ORDER_SCRIPT = 'dda8396858c30c686a47903c3fe1ca8894dae796dbcf7e6ca77013ae';
const ORDER_CONFIG_TOKEN = '001aa6b296f77518d1bdf6712a363112d1b0d30df8c2dc02ffd3631937cade39';
const BASIC_CONSTRAINT = 'bbf248c16f740f0e0ddc66a8b5261fcca9ffd8514ff012563809a1cd';
const SERVICE_BUDGET = 3_000_000n;
const ORDER_DEPOSIT = 2_000_000n;
const ORDER_TOKENS = 500n;
const PRICE = 100n;
const CHANGE_LOVELACE = 1_500_000n;

const constr = (index: number, fields: unknown[]) => new Tag(121 + index, fields);
const keyCredential = (keyHash: Uint8Array) => constr(0, [keyHash]);

/**
 * A v4 `OrderDatum` swapping `offered` of `unit` for at least one lovelace: owner and
 * destination are the caller's key, as in the swap order of the deployment above.
 */
function swapOrderDatum(owner: Uint8Array, unit: string, offered: bigint): Uint8Array {
  const assetClass = (u: string) =>
    constr(0, [hexToBytes(u.slice(0, 56)), hexToBytes(u.slice(56))]);
  const address = constr(0, [keyCredential(owner), constr(1, [])]);
  return encode(
    constr(0, [
      keyCredential(owner),
      constr(0, [address, constr(1, [])]),
      SERVICE_BUDGET,
      SERVICE_BUDGET,
      hexToBytes(ORDER_CONFIG_TOKEN),
      [
        [
          hexToBytes(BASIC_CONSTRAINT),
          constr(2, [
            [[assetClass(unit), offered]],
            [[constr(0, [new Uint8Array(), new Uint8Array()]), 1n]],
          ]),
        ],
      ],
      constr(0, []),
    ]),
  );
}

/** An output to the order script under an inline datum, in the map form that can carry one. */
function orderOutput(owner: Uint8Array, unit: string): TxOutput {
  const address = hexToBytes(`70${ORDER_SCRIPT}`);
  const value = {
    lovelace: SERVICE_BUDGET + ORDER_DEPOSIT,
    assets: new Map([[unit, ORDER_TOKENS]]),
  };
  const datum = [1, new Tag(24, swapOrderDatum(owner, unit, ORDER_TOKENS))];
  return {
    address,
    value,
    rest: new Map<number, unknown>([
      [0, address],
      [1, 0n],
      [2, datum],
    ]),
  };
}

describe.skipIf(!url || !skeyFile || !callerSkeyFile)(
  'Cardano transactions over a live UTxO RPC source',
  () => {
    const logger = pino({ level: 'silent' }) as never;
    let wallet: CardanoWalletService;
    let caller: CardanoWalletService;

    async function onChain(input: TxInput): Promise<boolean> {
      return (await wallet.resolve([input])).size > 0;
    }

    beforeAll(async () => {
      const chainState = new CardanoChainStateService(url!, logger);
      const params = () => chainState.protocolParams();
      wallet = await CardanoWalletService.create(url!, skeyFile!, params, logger);
      caller = await CardanoWalletService.create(url!, callerSkeyFile!, params, logger);
    });

    it(
      'pays a plain transaction',
      async () => {
        const txId = await wallet.pay([
          { address: caller.address, value: { lovelace: CALLER_FUNDS, assets: new Map() } },
        ]);

        await expect
          .poll(() => onChain({ txHash: txId, index: 0 }), {
            timeout: INCLUSION_TIMEOUT_MS,
            interval: 5_000,
          })
          .toBe(true);
      },
      INCLUSION_TIMEOUT_MS + 30_000,
    );

    it(
      'carries an offer that pays in tokens for the ADA to place a swap order',
      async () => {
        const held = (await caller.utxos()).find(
          (u) => u.output.value.assets.size === 1 && u.output.value.lovelace <= 2_000_000n,
        );
        expect(held, 'the caller needs a token UTxO of about 1.5 ADA').toBeDefined();
        const [[unit, tokens]] = [...held!.output.value.assets];
        const keyHash = caller.address.slice(1);

        const body = buildOfferBody(
          [held!.input],
          [
            orderOutput(keyHash, unit),
            {
              address: caller.address,
              value: {
                lovelace: CHANGE_LOVELACE,
                assets: new Map([[unit, tokens - ORDER_TOKENS - PRICE]]),
              },
            },
          ],
        );
        const sub = signSubTransaction(body, caller.key.signingKey);
        const quotes = new QuoteService(60, randomBytes(32));
        const quoteId = quotes.createQuote('ADA', 6_000_000n, [
          { amount: PRICE.toString(), currency: { id: unit, type: 'cardano:native', rawId: unit } },
        ]);
        const quote = quotes.getQuote(quoteId);
        expect(quote.status).toBe('ok');

        const service = new CardanoOfferService(wallet, logger);
        const { offerId } = service.submit(
          bytesToHex(encodeEnvelope(sub.bytes)),
          (quote as { status: 'ok'; quote: never }).quote,
        );
        await service.idle();
        const status = service.status(offerId);
        expect(status?.reason).toBeUndefined();
        expect(status?.state).toBe('submitted');

        // The ledger stores a sub-transaction's outputs under its own TxId, which is the offer id.
        const order = { txHash: offerId, index: 0 };
        await expect
          .poll(() => onChain(order), { timeout: INCLUSION_TIMEOUT_MS, interval: 5_000 })
          .toBe(true);
        const [placed] = (await wallet.resolve([order])).values();
        expect(bytesToHex(placed.address)).toBe(`70${ORDER_SCRIPT}`);
        expect(placed.value.assets.get(unit)).toBe(ORDER_TOKENS);
      },
      INCLUSION_TIMEOUT_MS + 30_000,
    );
  },
);
