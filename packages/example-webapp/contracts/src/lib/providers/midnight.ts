import { FinalizedTransaction } from '@midnight-ntwrk/ledger-v7';
import { MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
import { DEFAULT_CONFIG, PolkadotNodeClient } from '@midnight-ntwrk/wallet-sdk-node-client';
import { Startable } from '../startable.js';

export class PolkadotMidnightProvider implements MidnightProvider {
  #api: PolkadotNodeClient;

  constructor(api: PolkadotNodeClient) {
    this.#api = api;
  }

  async submitTx(tx: FinalizedTransaction): Promise<string> {
    const serializedTx = tx.serialize();
    await this.#api.sendMidnightTransactionAndWait(serializedTx, 'Finalized');
    const id = tx.identifiers().at(-1);
    if (!id) {
      throw new Error('No id found for tx');
    }
    return id;
  }
}

export class MidnightProviderStarter implements Startable<PolkadotMidnightProvider> {
  #url: string;

  constructor(url: string) {
    this.#url = url;
  }

  async start(): Promise<PolkadotMidnightProvider> {
    const api = await PolkadotNodeClient.init({
      nodeURL: new URL(this.#url),
      ...DEFAULT_CONFIG,
    });
    return new PolkadotMidnightProvider(api);
  }
}
