import type {
  PublicDataProvider,
  PrivateStateProvider,
  MidnightProvider,
  ZKConfigProvider,
} from '@midnight-ntwrk/midnight-js-types';
import type { Logger } from '@sundaeswap/capacity-exchange-core';

/** Platform-agnostic dependencies the user-side coupling needs. Carries no nodejs type,
 *  so the coupling runs wherever a WalletProvider does. */
export interface CouplingEnv {
  /** The user's coin public key, the only wallet capability the coupling needs. */
  coinPublicKey: string;
  publicDataProvider: PublicDataProvider;
  privateStateProvider: PrivateStateProvider;
  midnightProvider: MidnightProvider;
  zkConfigProvider: ZKConfigProvider<string>;
  proofServerUrl: string;
  indexerHttpUrl: string;
  logger: Logger;
}
