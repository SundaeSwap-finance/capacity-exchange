import { findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import {
  capacityExchangeWalletProvider,
  DEFAULT_MARGIN,
  type PromptForCurrency,
  type ConfirmOffer,
} from '@capacity-exchange/components';
import type { BrowserProviders } from './createBrowserProviders';
import { buildContractProviders } from './contractProviders';
import { config } from '../../config';
import * as Counter from '../../../contracts/counter/out/contract/index.js';

type CounterContract = Counter.Contract<undefined, Counter.Witnesses<undefined>>;
type CounterCircuitId = 'increment';

function createCounterContract(): CounterContract {
  const witnesses: Counter.Witnesses<undefined> = {};
  return new Counter.Contract(witnesses);
}

export async function findAndIncrementCounter(
  providers: BrowserProviders,
  contractAddress: string,
  promptForCurrency: PromptForCurrency,
  confirmOffer: ConfirmOffer
) {
  const { contractProviders, zkConfigProvider } = buildContractProviders<CounterCircuitId>(
    providers,
    providers.walletProvider,
    '/midnight/counter'
  );

  const cesWalletProvider = capacityExchangeWalletProvider({
    walletProvider: providers.walletProvider,
    connectedAPI: providers.connectedAPI,
    proofProvider: providers.proofProvider,
    zkConfigProvider,
    indexerUrl: config.indexerUrl,
    capacityExchangeUrls: [config.capacityExchangeUrl],
    margin: DEFAULT_MARGIN,
    promptForCurrency,
    confirmOffer,
    circuitId: 'increment',
  });

  contractProviders.walletProvider = cesWalletProvider;

  const contract = createCounterContract();
  await findDeployedContract(contractProviders, { contract, contractAddress });
  await submitCallTx(contractProviders, { contract, contractAddress, circuitId: 'increment' });
}
