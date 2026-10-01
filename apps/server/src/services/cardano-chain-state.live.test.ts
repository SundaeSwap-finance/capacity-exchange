import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pino from 'pino';
import { CardanoQueryClient } from '@utxorpc/sdk';
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
    await svc.start();
  });

  afterAll(async () => {
    await svc?.stop();
  });

  it('reads protocol params a fee can be computed from', () => {
    const params = svc.protocolParams();

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
    const query = new CardanoQueryClient({ uri: url! });
    const utxos = await query.searchUtxosByAddress(Buffer.from(addressHex!, 'hex'));

    expect(utxos.length).toBeGreaterThan(0);
    for (const utxo of utxos) {
      expect(toBigInt(utxo.parsedValued?.coin, 'coin')).toBeGreaterThan(0n);
    }
  });
});
