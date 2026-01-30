import { ContractProviders } from '@midnight-ntwrk/midnight-js-contracts';
import { Contract } from '@midnight-ntwrk/midnight-js-types';
import { AppContext } from '../app-context.js';

export function getContractProviders<T extends Contract>(ctx: AppContext): ContractProviders<T> {
  return {
    midnightProvider: ctx.midnightProvider,
    privateStateProvider: ctx.privateStateProvider,
    proofProvider: ctx.proofProvider,
    publicDataProvider: ctx.publicDataProvider,
    walletProvider: ctx.walletContext.walletProvider,
    zkConfigProvider: ctx.zkConfigProvider,
  };
}
