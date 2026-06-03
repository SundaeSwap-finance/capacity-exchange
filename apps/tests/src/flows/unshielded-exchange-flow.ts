import type { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { buildProviders, createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { CompiledCounterContract, Counter, type CounterContract } from '@capacity-exchange/demo-contracts/counter';
import { firstValueFrom } from 'rxjs';
import { buildFlowCtx, type FlowCtxConfig } from '../util/testUtils.js';
import { createTestCesProvider } from '../util/cesProvider.js';

const logger = createLogger(import.meta);

interface State {
  userDust: bigint;
  userToken: bigint;
  serverToken: bigint;
  counter: bigint;
}

export interface UnshieldedExchangeFlowResult {
  status: string;
  pre: Record<string, string>;
  post: Record<string, string>;
}

/**
 * Case B end-to-end: user pays unshielded `tokenRawId`, CES sponsors counter
 * increment in DUST. Asserts user.dust=0 pre, user.token decreases,
 * server.token increases, counter +1.
 */
export async function runUnshieldedExchangeFlow(
  networkId: string,
  userFlowConfig: FlowCtxConfig,
  serverFlowConfig: FlowCtxConfig,
  counterAddress: string,
  cesUrl: string,
  tokenRawId: string
): Promise<UnshieldedExchangeFlowResult> {
  const [userCtx, serverCtx] = await Promise.all([
    buildFlowCtx(networkId, userFlowConfig),
    buildFlowCtx(networkId, serverFlowConfig),
  ]);
  logger.info({ tokenRawId, counterAddress, cesUrl }, 'Starting unshielded exchange flow');

  const pre = await snapshot(userCtx, serverCtx, tokenRawId, counterAddress);
  logger.info(stringify(pre), 'Pre');

  if (pre.userDust !== 0n) {
    throw new Error(`pre-condition: user dust must be 0, got ${pre.userDust}`);
  }

  const providers = {
    ...buildProviders<CounterContract>(userCtx, CompiledContract.getCompiledAssetsPath(CompiledCounterContract)),
    walletProvider: createTestCesProvider(userCtx, networkId, cesUrl, tokenRawId),
  };
  await findDeployedContract(providers, {
    compiledContract: CompiledCounterContract,
    contractAddress: counterAddress,
  });

  logger.info('Submitting counter increment via CES unshielded exchange flow (user pays with unshielded token)');
  const result = await submitCallTx(providers, {
    compiledContract: CompiledCounterContract,
    contractAddress: counterAddress,
    circuitId: 'increment' as const,
  });
  logger.info({ status: result.public.status }, 'Submitted, waiting for state to settle');
  await new Promise((r) => setTimeout(r, 8_000));

  const post = await snapshot(userCtx, serverCtx, tokenRawId, counterAddress);
  logger.info(stringify(post), 'Post');

  const failures: string[] = [];
  if (post.userToken >= pre.userToken)
    {failures.push(`user token did not decrease: pre=${pre.userToken} post=${post.userToken}`);}
  if (post.serverToken <= pre.serverToken)
    {failures.push(`server token did not increase: pre=${pre.serverToken} post=${post.serverToken}`);}
  if (post.counter !== pre.counter + 1n) {failures.push(`counter did not +1: pre=${pre.counter} post=${post.counter}`);}
  if (failures.length > 0) {
    throw new Error(`post-condition:\n  - ${failures.join('\n  - ')}`);
  }

  return { status: result.public.status, pre: stringify(pre), post: stringify(post) };
}

async function snapshot(
  userCtx: AppContext,
  serverCtx: AppContext,
  tokenRawId: string,
  counterAddress: string
): Promise<State> {
  const [user, server, counter] = await Promise.all([
    walletState(userCtx, tokenRawId),
    walletState(serverCtx, tokenRawId),
    counterRound(userCtx, counterAddress),
  ]);
  return { userDust: user.dust, userToken: user.token, serverToken: server.token, counter };
}

async function walletState(ctx: AppContext, tokenRawId: string): Promise<{ dust: bigint; token: bigint }> {
  const state = await firstValueFrom(ctx.walletContext.walletFacade.state());
  return {
    dust: state.dust?.balance(new Date()) ?? 0n,
    token: state.unshielded?.balances[tokenRawId] ?? 0n,
  };
}

async function counterRound(ctx: AppContext, counterAddress: string): Promise<bigint> {
  const state = await ctx.publicDataProvider.queryContractState(counterAddress);
  if (!state) {throw new Error(`counter contract not found at ${counterAddress}`);}
  return BigInt(Counter.ledger(state.data).round);
}

function stringify(s: State): Record<string, string> {
  return {
    userDust: s.userDust.toString(),
    userToken: s.userToken.toString(),
    serverToken: s.serverToken.toString(),
    counter: s.counter.toString(),
  };
}
