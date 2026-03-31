import { buildProviders } from '@capacity-exchange/midnight-node';
import { toTxResult, getShieldedBalance } from '@capacity-exchange/midnight-core';
import {
  capacityExchangeWalletProvider,
  DEFAULT_MARGIN,
} from '@capacity-exchange/components';
import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { loadContractsConfig } from '../../contracts/src/lib/contracts-config';
import {
  CompiledCounterContract,
  Counter,
  type CounterContract,
} from '../../contracts/src/counter/lib/contract';
import type { CliConfig } from '../lib/config';
import { withCliContext, createConnectedAPIFromContext } from '../lib/context';
import { createCurrencyPrompt, createOfferConfirm } from '../lib/ces-prompts';
import { checkCesHealth } from '../lib/ces-health';
import { createSpinner, printNote, printSuccess, printJson, isJsonMode } from '../lib/output';

export interface IncrementOptions {
  currency?: string;
  autoConfirm?: boolean;
  contractAddress?: string;
  mnemonic?: string;
}

export interface IncrementReceipt {
  status: 'success';
  txHash: string;
  counterValue: string;
  blockHeight: string;
  contractAddress: string;
}

export async function runIncrement(config: CliConfig, opts: IncrementOptions): Promise<void> {
  let contractAddress = opts.contractAddress;
  if (!contractAddress) {
    const contractsConfig = loadContractsConfig(config.networkId);
    if (!contractsConfig?.counter?.contractAddress) {
      throw new Error(
        `No counter contract found for network '${config.networkId}'. ` +
          'Provide --contract-address or deploy a counter first.'
      );
    }
    contractAddress = contractsConfig.counter.contractAddress;
  }

  // Pre-flight CES health check
  const spin = createSpinner();
  spin.start('Checking CES exchange...');
  const health = await checkCesHealth(config.capacityExchangeUrl);
  if (health.status === 'syncing') {
    spin.stop('CES exchange is syncing');
    throw new Error('CES exchange is syncing, try again later.');
  }
  if (health.status === 'offline') {
    spin.stop('CES exchange is offline');
    throw new Error(`CES exchange at ${config.capacityExchangeUrl} is offline: ${health.error}`);
  }
  spin.stop('CES exchange is healthy');

  spin.start('Syncing wallet...');
  const result = await withCliContext(config, opts.mnemonic, async (ctx) => {
    spin.stop('Wallet synced');

    const connectedAPI = createConnectedAPIFromContext(ctx, config);

    const cesWalletProvider = capacityExchangeWalletProvider({
      walletProvider: ctx.walletContext.walletProvider,
      connectedAPI,
      indexerUrl: config.endpoints.indexerHttpUrl,
      capacityExchangeUrls: [config.capacityExchangeUrl],
      margin: DEFAULT_MARGIN,
      promptForCurrency: createCurrencyPrompt({
        currencyFlag: opts.currency,
        getTokenBalance: (tokenColor) => getShieldedBalance(ctx.walletContext.walletFacade, tokenColor),
      }),
      confirmOffer: createOfferConfirm(opts.autoConfirm),
    });

    const providers = buildProviders<CounterContract>(ctx, './contracts/counter/out');
    const cesProviders = {
      ...providers,
      walletProvider: cesWalletProvider,
    };

    spin.start('Finding deployed contract...');
    await findDeployedContract(cesProviders, {
      compiledContract: CompiledCounterContract,
      contractAddress,
    });
    spin.stop('Contract found');

    // Note: CES currency selection and offer confirmation prompts happen inside
    // submitCallTx (via balanceTx), so we don't wrap this in a spinner to avoid
    // conflicting with interactive prompts.
    const callResult = await submitCallTx(cesProviders, {
      compiledContract: CompiledCounterContract,
      contractAddress,
      circuitId: 'increment' as any,
    });

    spin.start('Querying counter value...');
    const contractState = await ctx.publicDataProvider.queryContractState(contractAddress);
    const ledgerState = contractState ? Counter.ledger(contractState.data) : null;
    spin.stop('Done');

    return {
      txResult: toTxResult(contractAddress, callResult.public),
      counterValue: ledgerState?.round?.toString() ?? 'unknown',
    };
  });

  const receipt: IncrementReceipt = {
    status: 'success',
    txHash: result.txResult.txHash,
    counterValue: result.counterValue,
    blockHeight: result.txResult.blockHeight,
    contractAddress,
  };

  if (isJsonMode()) {
    printJson(receipt);
  } else {
    printNote(
      [
        `Tx Hash:       ${receipt.txHash}`,
        `Counter Value: ${receipt.counterValue}`,
        `Block Height:  ${receipt.blockHeight}`,
        `Contract:      ${receipt.contractAddress}`,
      ].join('\n'),
      'Transaction successful'
    );
    printSuccess('Counter incremented via CES');
  }
}
