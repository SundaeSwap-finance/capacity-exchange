import { buildProviders, createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { CompiledCounterContract, type CounterContract } from '@capacity-exchange/demo-contracts/counter';
import { buildFlowCtx, type FlowCtxConfig } from '../util/testUtils.js';
import { createTestCesProvider } from '../util/cesProvider.js';

const logger = createLogger(import.meta);

export interface ExchangeFlowResult {
  status: string;
}

export async function runExchangeFlow(
  networkId: string,
  flowConfig: FlowCtxConfig,
  counterAddress: string,
  cesUrl: string,
  derivedTokenColor: string,
): Promise<ExchangeFlowResult> {
  logger.info('Building exchange-flow AppContext');
  const ctx = await buildFlowCtx(networkId, flowConfig);
  logger.info('Starting exchange flow: increment counter via CES');

  const providers = {
    ...buildProviders<CounterContract>(ctx, CompiledContract.getCompiledAssetsPath(CompiledCounterContract)),
    walletProvider: createTestCesProvider(ctx, networkId, cesUrl, derivedTokenColor),
  };

  await findDeployedContract(providers, {
    compiledContract: CompiledCounterContract,
    contractAddress: counterAddress,
  });

  logger.info('Submitting counter increment via CES exchange flow');
  const result = await submitCallTx(providers, {
    compiledContract: CompiledCounterContract,
    contractAddress: counterAddress,
    circuitId: 'increment' as const,
  });

  logger.info({ status: result.public.status }, 'Exchange flow completed');
  return { status: result.public.status };
}
