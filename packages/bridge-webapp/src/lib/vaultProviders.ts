import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import {
  connectedApiProvidersAdapter,
  buildMidnightProviders,
  type BrowserProviderConfig,
  type ShieldedAddressInfo,
} from '@capacity-exchange/midnight-core';

/** Build MidnightProviders for a vault contract using a ConnectedAPI wallet. */
export function buildVaultProviders<C extends string>(
  connectedAPI: ConnectedAPI,
  shieldedAddress: ShieldedAddressInfo,
  config: BrowserProviderConfig
): MidnightProviders<C> {
  const { walletProvider, midnightProvider } = connectedApiProvidersAdapter(connectedAPI, shieldedAddress);
  return buildMidnightProviders<C>(walletProvider, midnightProvider, '/midnight/vault', config);
}
