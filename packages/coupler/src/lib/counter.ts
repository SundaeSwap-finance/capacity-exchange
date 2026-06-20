import * as path from 'path';
import { createRequire } from 'module';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { inMemoryPrivateStateProvider, buildUnprovenCallTx } from '@sundaeswap/capacity-exchange-core';
import { AppContext, buildProviders } from '@sundaeswap/capacity-exchange-nodejs';
import { Counter, type CounterContract } from '@capacity-exchange/demo-contracts/counter';

/**
 * Demo op for the coupler e2e: an increment of the pre-deployed counter contract.
 * This module is the only place the coupler touches demo-contracts.
 */

const require = createRequire(import.meta.url);

/** Filesystem dir holding the counter's keys/ and zkir/ (for its zkConfig provider). */
const COUNTER_OUT = path.resolve(
  path.dirname(require.resolve('@capacity-exchange/demo-contracts/counter/out/contract/index.js')),
  '..'
);

const compiledCounter = CompiledContract.make<CounterContract>('Counter', Counter.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(COUNTER_OUT)
);

/**
 * Build and prove an increment of the pre-deployed counter the way a dapp builds its own
 * op: the SDK call path, yielding a normal unbound tx to hand to couple(). The counter
 * has vacant witnesses and no private state, so it gets a throwaway in-memory store.
 */
export async function buildCounterIncrementTx(ctx: AppContext, counterAddress: string): Promise<UnboundTransaction> {
  const providers = {
    ...buildProviders<CounterContract>(ctx, COUNTER_OUT),
    privateStateProvider: inMemoryPrivateStateProvider(),
  };
  const unproven = await buildUnprovenCallTx(providers, {
    compiledContract: compiledCounter,
    contractAddress: counterAddress,
    circuitId: 'increment',
  });
  return providers.proofProvider.proveTx(unproven.private.unprovenTx);
}

/** Read the counter's round value. */
export async function readCounterRound(ctx: AppContext, counterAddress: string): Promise<bigint> {
  const state = await ctx.publicDataProvider.queryContractState(counterAddress);
  if (!state) {
    throw new Error(`Counter not found at ${counterAddress}`);
  }
  return Counter.ledger(state.data).round;
}
