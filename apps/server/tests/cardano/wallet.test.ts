import { describe, it, expect } from 'vitest';
import { ReadyResponse } from '../../src/models/health.js';
import { CLIENT } from '../utils.js';
import { fund, SERVER_ADDRESS } from './devnet.js';

type CardanoStatus = NonNullable<typeof ReadyResponse.static.cardano>;

async function cardanoStatus(): Promise<CardanoStatus> {
  const { cardano } = (await CLIENT.getReadiness()).data;
  if (!cardano) {
    throw new Error('The server reports no Cardano status; is it configured for Cardano?');
  }
  return cardano;
}

describe('Cardano wallet', () => {
  it('detects ADA paid to the server wallet', async () => {
    // The wallet only sees blocks from where the server started following, so
    // payments must wait until it is following the tip.
    await expect.poll(async () => (await cardanoStatus()).status, { timeout: 30_000 }).toBe('ok');
    const before = BigInt((await cardanoStatus()).walletLovelace!);

    fund(SERVER_ADDRESS, 5_000_000n);

    // A block every second; a missing payment usually means the server could not
    // parse its block (see its log).
    await expect
      .poll(async () => BigInt((await cardanoStatus()).walletLovelace!), { timeout: 30_000 })
      .toBe(before + 5_000_000n);
  });
});
