import { findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import type { WalletProvider, MidnightProvider } from '@midnight-ntwrk/midnight-js-types';
import {
  capacityExchangeWalletProvider,
  DEFAULT_MARGIN,
  type BalanceSealedTransaction,
  type PromptForCurrency,
  type ConfirmOffer,
} from '@capacity-exchange/providers';
import { buildMidnightProviders } from '@capacity-exchange/midnight-core';
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

/**
 * Finds a deployed counter contract and submits an increment transaction
 * using the provided wallet provider for balancing.
 */
export async function incrementCounter(
  providers: { midnightProvider: MidnightProvider },
  contractAddress: string,
  walletProvider: WalletProvider,
  config: NetworkConfig
) {
  const contractProviders = buildMidnightProviders<CounterCircuitId>(
    walletProvider,
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

/**
 * Convenience wrapper that builds a CES wallet provider and increments the counter.
 */
export async function findAndIncrementCounter(
  walletProvider: WalletProvider,
  midnightProvider: MidnightProvider,
  balanceSealedTransaction: BalanceSealedTransaction,
  contractAddress: string,
  promptForCurrency: PromptForCurrency,
  confirmOffer: ConfirmOffer,
  config: NetworkConfig
) {
  const cesWalletProvider = capacityExchangeWalletProvider({
    coinPublicKey: walletProvider.getCoinPublicKey(),
    encryptionPublicKey: walletProvider.getEncryptionPublicKey(),
    balanceSealedTransaction,
    indexerUrl: config.indexerUrl,
    capacityExchangeUrls: [config.capacityExchangeUrl],
    margin: DEFAULT_MARGIN,
    promptForCurrency,
    confirmOffer,
  });

  const contractProviders = buildMidnightProviders<CounterCircuitId>(
    cesWalletProvider,
    midnightProvider,
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
