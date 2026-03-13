import { findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import {
  capacityExchangeWalletProvider,
  DEFAULT_MARGIN,
  type PromptForCurrency,
  type ConfirmOffer,
} from '@capacity-exchange/components';
import { buildMidnightProviders } from '@capacity-exchange/midnight-core';
import type { ConnectedApiProviders } from '@capacity-exchange/midnight-core';
import type { NetworkConfig } from '../../config';
import * as Counter from '../../../contracts/counter/out/contract/index.js';

type CounterContract = Counter.Contract;
type CounterCircuitId = 'increment';

const compiledCounterContract = CompiledContract.make<CounterContract>('Counter', Counter.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets('/midnight/counter')
);

export interface GetCounterValueResult {
  contractAddress: string;
  round: string;
}

export async function getCounterValue(contractAddress: string, config: NetworkConfig): Promise<GetCounterValueResult> {
  const publicDataProvider = indexerPublicDataProvider(config.indexerUrl, config.indexerWsUrl);
  const contractState = await publicDataProvider.queryContractState(contractAddress);

  if (!contractState) {
    throw new Error(`Contract not found at address: ${contractAddress}`);
  }

  const ledgerState = Counter.ledger(contractState.data);
  return {
    contractAddress,
    round: ledgerState.round.toString(),
  };
}

export async function findAndIncrementCounter(
  providers: ConnectedApiProviders,
  contractAddress: string,
  promptForCurrency: PromptForCurrency,
  confirmOffer: ConfirmOffer,
  config: NetworkConfig
) {
  const cesWalletProvider = capacityExchangeWalletProvider({
    walletProvider: providers.walletProvider,
    connectedAPI: providers.connectedAPI,
    indexerUrl: config.indexerUrl,
    capacityExchangeUrls: [config.capacityExchangeUrl],
    margin: DEFAULT_MARGIN,
    promptForCurrency,
    confirmOffer,
  });

  const contractProviders = buildMidnightProviders<CounterCircuitId>(
    cesWalletProvider,
    providers.midnightProvider,
    '/midnight/counter',
    config
  );

  await findDeployedContract(contractProviders, {
    compiledContract: compiledCounterContract,
    contractAddress,
  });
  await submitCallTx(contractProviders, {
    compiledContract: compiledCounterContract,
    contractAddress,
    circuitId: 'increment' as CounterCircuitId,
  });
}
