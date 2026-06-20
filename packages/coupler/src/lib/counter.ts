import * as crypto from 'crypto';
import * as path from 'path';
import { createRequire } from 'module';
import { NodeZkConfigProvider } from '@midnight-ntwrk/midnight-js-node-zk-config-provider';
import {
  inMemoryPrivateStateProvider,
  runCircuit,
  type CircuitRunner,
  type Leg,
} from '@sundaeswap/capacity-exchange-core';
import { AppContext, buildProviders } from '@sundaeswap/capacity-exchange-nodejs';
import { Counter, type CounterContract } from '@capacity-exchange/demo-contracts/counter';
import type { ZKConfigProvider } from '@midnight-ntwrk/midnight-js-types';

/**
 * Demo op for the coupler e2e: an increment of the pre-deployed counter contract.
 * This module is the only place the coupler touches demo-contracts.
 */

/** A leg plus its proving-key provider, proven on its own before coupling. */
export interface CounterOp {
  leg: Leg;
  zkConfig: ZKConfigProvider<string>;
}

const require = createRequire(import.meta.url);

/** Filesystem dir holding the counter's keys/ and zkir/ (for its zkConfig provider). */
const COUNTER_OUT = path.resolve(
  path.dirname(require.resolve('@capacity-exchange/demo-contracts/counter/out/contract/index.js')),
  '..'
);

/**
 * Build an increment leg against an already-deployed counter. The counter has
 * vacant witnesses and no private state, but getStates requires a defined entry,
 * so it gets its own in-memory provider (never the shared level DB).
 */
export async function buildCounterIncrementLeg(ctx: AppContext, counterAddress: string): Promise<CounterOp> {
  const providers = buildProviders<CounterContract>(ctx, COUNTER_OUT);
  const privateStateId = crypto.randomBytes(32).toString('hex');
  const privateStateProvider = inMemoryPrivateStateProvider();
  await privateStateProvider.set(privateStateId, {});
  const counter = new Counter.Contract({}) as unknown as CircuitRunner;
  const leg = await runCircuit(
    { ...providers, privateStateProvider },
    counter,
    counterAddress,
    privateStateId,
    'increment',
    []
  );
  return { leg, zkConfig: new NodeZkConfigProvider(COUNTER_OUT) };
}

/** Read the counter's round value. */
export async function readCounterRound(ctx: AppContext, counterAddress: string): Promise<bigint> {
  const state = await ctx.publicDataProvider.queryContractState(counterAddress);
  if (!state) {
    throw new Error(`Counter not found at ${counterAddress}`);
  }
  return Counter.ledger(state.data).round;
}
