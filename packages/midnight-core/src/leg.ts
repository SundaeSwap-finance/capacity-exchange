import {
  ContractState,
  createCircuitContext,
  type CircuitContext,
  type CircuitResults,
  type ProofData,
  type EncodedZswapLocalState,
} from '@midnight-ntwrk/compact-runtime';
import { getStates } from '@midnight-ntwrk/midnight-js/contracts';
import type { PrivateStateProvider, PublicDataProvider } from '@midnight-ntwrk/midnight-js/types';

export type EncodedOutput = EncodedZswapLocalState['outputs'][number];
export type EncodedInput = EncodedZswapLocalState['inputs'][number];

export interface LegProviders {
  walletProvider: { getCoinPublicKey(): string };
  publicDataProvider: PublicDataProvider;
  privateStateProvider: PrivateStateProvider;
}

export interface CircuitRunner {
  impureCircuits: Record<
    string,
    (ctx: CircuitContext<unknown>, ...args: unknown[]) => Promise<CircuitResults<unknown, unknown>>
  >;
}

/** One contract call from a local circuit run, built by one party in
 *  isolation and assembled into a transaction fragment (see fragment.ts). */
export interface Leg {
  contractAddress: string;
  circuitName: string;
  proofData: ProofData;
  /** Pre-state the circuit ran against, re-deserialized into ledger-v9 at combine time. */
  contractState: { serialize(): Uint8Array };
  /** Coins this circuit produced, in Compact byte form. */
  zswapOutputs: EncodedOutput[];
  zswapInputs: EncodedInput[];
}

/** Run one circuit locally against current on-chain state (no proving, no
 *  submission) and capture the result as a Leg. */
export async function runCircuit(
  providers: LegProviders,
  contract: CircuitRunner,
  contractAddress: string,
  privateStateId: string,
  circuitName: string,
  args: unknown[]
): Promise<Leg> {
  const coinPublicKey = providers.walletProvider.getCoinPublicKey();
  const states = await getStates(
    providers.publicDataProvider,
    providers.privateStateProvider,
    contractAddress,
    privateStateId
  );
  const contractState = states.contractState.deserialize({ v9: ContractState });
  const ctx = createCircuitContext({
    circuitId: circuitName,
    contractAddress,
    coinPublicKeyOrZswapState: coinPublicKey,
    contractState,
    privateState: states.privateState,
  });
  const circuit = contract.impureCircuits[circuitName];
  if (!circuit) {
    throw new Error(`runCircuit: contract has no circuit '${circuitName}'`);
  }
  const r = await circuit(ctx, ...args);
  // The trace is in completion order, so the root call (this circuit) is last.
  const trace = r.context.callProofDataTrace;
  const call = trace[trace.length - 1];
  if (!call || call.contractAddress !== contractAddress || call.circuitId !== circuitName) {
    throw new Error(`runCircuit: '${circuitName}' left no proof data for its own call`);
  }
  return {
    contractAddress,
    circuitName,
    proofData: call,
    contractState,
    zswapOutputs: call.zswapLocalState.outputs ?? [],
    zswapInputs: call.zswapLocalState.inputs ?? [],
  };
}
