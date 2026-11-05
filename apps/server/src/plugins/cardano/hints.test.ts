import { describe, it, expect } from 'vitest';
import Fastify from 'fastify';
import { fileURLToPath } from 'url';
import { Address } from '@capacity-exchange/cardano-core';
import hintsPlugin from './hints.js';
import { readSigningKeyFile } from '../../config/cardanoKeys.js';
import type { AppConfig } from '../../loadConfig.js';

const KEYS = '../../../../../testnet/cardano';
const keyFile = (name: string) => fileURLToPath(new URL(`${KEYS}/${name}`, import.meta.url));
// testnet/cardano/server.addr and funded.addr.
const SERVER_ADDR = 'addr_test1vzxtav7k76x0523castslppm64kvygpt2wpmyg7l4ggegqsgmh0e8';

async function startWith(walletAddress: string) {
  const app = Fastify({ logger: false });
  const config: Partial<AppConfig> = {
    cardano: {
      utxorpcUrl: 'unused',
      walletAddress: Address.fromBech32(walletAddress),
      registrationKeyPair: readSigningKeyFile(keyFile('server.skey')),
      walletKeyPair: readSigningKeyFile(keyFile('server.skey')),
    },
    priceFormulas: {
      ADA: [
        {
          currency: { type: 'cardano:ada', rawId: '' },
          basePrice: '0',
          tiers: [{ above: '0', rateNumerator: '1', rateDenominator: '1' }],
        },
      ],
    },
  };
  app.decorate('config', config as AppConfig);
  app.decorate('cardanoWalletService', { lovelace: () => 0n } as never);
  await app.register(hintsPlugin);
  await app.ready();
  return app;
}

describe('cardano hints plugin', () => {
  it('starts the hint service when the key is present', async () => {
    const app = await startWith(SERVER_ADDR);
    expect(app.cardanoHintService).not.toBeNull();
    await app.close();
  });
});
