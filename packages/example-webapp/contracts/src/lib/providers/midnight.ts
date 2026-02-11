import { FinalizedTransaction } from '@midnight-ntwrk/ledger-v7';
import { MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
import { DEFAULT_CONFIG, PolkadotNodeClient } from '@midnight-ntwrk/wallet-sdk-node-client';
import { createLogger } from '../logger.js';

const logger = createLogger(import.meta);

class PolkadotMidnightProvider implements MidnightProvider {
  #api: PolkadotNodeClient;

  constructor(api: PolkadotNodeClient) {
    this.#api = api;
  }

  async submitTx(tx: FinalizedTransaction): Promise<string> {
    const serializedTx = tx.serialize();
    logger.log(`Submitting tx (${serializedTx.byteLength} bytes)...`);

    await this.#api.sendMidnightTransactionAndWait(serializedTx, 'Finalized');
    const id = tx.identifiers().at(-1);
    if (!id) {
      throw new Error('No id found for tx');
    }
    return id;
  }
}

export async function createMidnightProvider(nodeUrl: string): Promise<MidnightProvider> {
  const api = await PolkadotNodeClient.init({
    nodeURL: new URL(nodeUrl),
    ...DEFAULT_CONFIG,
  });
  return new PolkadotMidnightProvider(api);
}
