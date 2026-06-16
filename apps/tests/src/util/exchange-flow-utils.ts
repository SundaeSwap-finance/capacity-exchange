import type { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { buildProviders, createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import { toRawTokenType } from '@sundaeswap/capacity-exchange-core';
import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { CompiledCounterContract, Counter, type CounterContract } from '@capacity-exchange/demo-contracts/counter';
import { firstValueFrom } from 'rxjs';
import { buildFlowCtx, type FlowCtxConfig } from './testUtils.js';
import { createTestCesProvider } from './cesProvider.js';

const logger = createLogger(import.meta);

interface State {
  userDust: bigint;
  userToken: bigint;
  serverToken: bigint;
  counter: bigint;
}

export interface ExchangeFlowResult {
  status: string;
  pre: Record<string, string>;
  post: Record<string, string>;
}

export async function runExchangeFlowCore(
  tokenKind: 'shielded' | 'unshielded',
  networkId: string,
  userFlowConfig: FlowCtxConfig,
  serverFlowConfig: FlowCtxConfig,
  counterAddress: string,
  cesUrl: string,
  tokenRawId: string
): Promise<ExchangeFlowResult> {
  const [userCtx, serverCtx] = await Promise.all([
    buildFlowCtx(networkId, userFlowConfig),
    buildFlowCtx(networkId, serverFlowConfig),
  ]);
  logger.info({ tokenRawId, counterAddress, cesUrl }, `Starting ${tokenKind} exchange flow`);

  const pre = await snapshot(tokenKind, userCtx, serverCtx, tokenRawId, counterAddress);
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

  logger.info(`Submitting counter increment via CES ${tokenKind} exchange flow`);
  const result = await submitCallTx(providers, {
    compiledContract: CompiledCounterContract,
    contractAddress: counterAddress,
    circuitId: 'increment' as const,
  });
  logger.info({ status: result.public.status }, 'Submitted, waiting for state to settle');
  await new Promise((r) => setTimeout(r, 8_000));

  const post = await snapshot(tokenKind, userCtx, serverCtx, tokenRawId, counterAddress);
  logger.info(stringify(post), 'Post');

  const failures: string[] = [];
  if (post.userToken >= pre.userToken) {
    failures.push(`user token did not decrease: pre=${pre.userToken} post=${post.userToken}`);
  }
  if (post.serverToken <= pre.serverToken) {
    failures.push(`server token did not increase: pre=${pre.serverToken} post=${post.serverToken}`);
  }
  if (post.counter !== pre.counter + 1n) {
    failures.push(`counter did not +1: pre=${pre.counter} post=${post.counter}`);
  }
  if (failures.length > 0) {
    throw new Error(`post-condition:\n  - ${failures.join('\n  - ')}`);
  }

  return { status: result.public.status, pre: stringify(pre), post: stringify(post) };
}

async function snapshot(
  tokenKind: 'shielded' | 'unshielded',
  userCtx: AppContext,
  serverCtx: AppContext,
  tokenRawId: string,
  counterAddress: string
): Promise<State> {
  const [user, server, counter] = await Promise.all([
    walletState(tokenKind, userCtx, tokenRawId),
    walletState(tokenKind, serverCtx, tokenRawId),
    counterRound(userCtx, counterAddress),
  ]);
  return { userDust: user.dust, userToken: user.token, serverToken: server.token, counter };
}

async function walletState(
  tokenKind: 'shielded' | 'unshielded',
  ctx: AppContext,
  tokenRawId: string
): Promise<{ dust: bigint; token: bigint }> {
  const state = await firstValueFrom(ctx.walletContext.walletFacade.state());
  return {
    dust: state.dust?.balance(new Date()) ?? 0n,
    token:
      (tokenKind === 'shielded'
        ? state.shielded?.balances[tokenRawId]
        : state.unshielded?.balances[toRawTokenType(tokenRawId)]) ?? 0n,
  };
}

async function counterRound(ctx: AppContext, counterAddress: string): Promise<bigint> {
  const state = await ctx.publicDataProvider.queryContractState(counterAddress);
  if (!state) {
    throw new Error(`counter contract not found at ${counterAddress}`);
  }
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
