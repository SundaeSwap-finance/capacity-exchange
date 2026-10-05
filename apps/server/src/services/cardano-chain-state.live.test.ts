import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import pino from 'pino';
import { createPromiseClient } from '@connectrpc/connect';
import { createGrpcTransport } from '@connectrpc/connect-node';
import { queryConnect } from '@utxorpc/spec';
import { CardanoChainStateService, toBigInt } from './cardano-chain-state.js';

/**
 * Runs against a live UTxO RPC source such as Dolos, and is skipped without one:
 *   UTXORPC_LIVE_TEST_URL=http://127.0.0.1:50151 \
 *   UTXORPC_LIVE_TEST_ADDRESS=<address, hex bytes> bunx vitest run cardano-chain-state.live
 * Blocks arrive every ~20 s on average, so following the tip can take a minute.
 */
const url = process.env.UTXORPC_LIVE_TEST_URL;
const addressHex = process.env.UTXORPC_LIVE_TEST_ADDRESS;
const FOLLOW_TIMEOUT_MS = 120_000;

describe.skipIf(!url)('CardanoChainStateService against a live UTxO RPC source', () => {
  let svc: CardanoChainStateService;

  beforeAll(async () => {
    svc = new CardanoChainStateService(url!, pino({ level: 'silent' }) as never);
    svc.start();
    await vi.waitFor(() => expect(svc.health().status).toBe('ok'), { timeout: 30_000 });
  }, 40_000);

  afterAll(async () => {
    await svc?.stop();
  });

  it('reads protocol params a fee can be computed from', async () => {
    const params = await svc.protocolParams();

    expect(params.minFeeCoefficient).toBeGreaterThan(0n);
    expect(params.minFeeConstant).toBeGreaterThan(0n);
    expect(params.coinsPerUtxoByte).toBeGreaterThan(0n);
    expect(params.maxTxSize).toBeGreaterThan(0n);
    expect(params.prices.memory.denominator).toBeGreaterThan(0n);
    expect(params.prices.steps.denominator).toBeGreaterThan(0n);
  });

  it(
    'follows the tip as new blocks arrive',
    async () => {
      const first = svc.tip();

      await expect
        .poll(() => svc.tip().slot, { timeout: FOLLOW_TIMEOUT_MS, interval: 1_000 })
        .toBeGreaterThan(first.slot);
      expect(svc.health().status).toBe('ok');
    },
    FOLLOW_TIMEOUT_MS + 10_000,
  );

  it.skipIf(!addressHex)('finds the UTxOs at an address', async () => {
    const transport = createGrpcTransport({ httpVersion: '2', baseUrl: url! });
    const query = createPromiseClient(queryConnect.QueryService, transport);
    const exactAddress = Buffer.from(addressHex!, 'hex');
    const { items } = await query.searchUtxos({
      predicate: {
        match: { utxoPattern: { case: 'cardano', value: { address: { exactAddress } } } },
      },
    });

    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      const output = item.parsedState.case === 'cardano' ? item.parsedState.value : undefined;
      expect(toBigInt(output?.coin, 'coin')).toBeGreaterThan(0n);
    }
  });
});
