import type { InitialAPI, ConnectedAPI, Configuration } from '@midnight-ntwrk/dapp-connector-api';

export interface WalletConnection {
  wallet: ConnectedAPI;
  config: Configuration;
}

/**
 * Connects to the Midnight wallet extension.
 * Prompts the user to approve the connection in Lace.
 */
export async function connectWallet(connector: InitialAPI, networkId: string): Promise<WalletConnection> {
  const wallet = await connector.connect(networkId);
  const config = await wallet.getConfiguration();
  return { wallet, config };
}
