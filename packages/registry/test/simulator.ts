import * as crypto from 'crypto';
import { createConstructorContext, createCircuitContext, type CircuitContext } from '@midnight-ntwrk/compact-runtime';
import * as ocrt from '@midnightntwrk/onchain-runtime-v4';
import * as Registry from '../contract/out/contract/index.js';
import type { Witnesses } from '../contract/out/contract/index.js';
import { entryToContract, type RegistryEntry } from '../src/types.js';

export { ocrt };

const DUMMY_COIN_PUBLIC_KEY = '0'.repeat(64);

type PrivateState = {
  secretKey: Uint8Array;
};

function makeWitnesses(secretKey: Uint8Array): Witnesses<PrivateState> {
  return {
    secretKey: ({ privateState }) => [privateState, secretKey],
  };
}

export function makeRecipient(): { bytes: Uint8Array } {
  return { bytes: ocrt.encodeUserAddress(ocrt.sampleUserAddress()) };
}

const CONTRACT_ADDRESS = ocrt.dummyContractAddress();

/**
 * Runs the registry's circuits in-process against an evolving contract state, with no chain and no
 * proof server. Each call starts a fresh circuit context from the state the previous call left.
 */
export class RegistrySimulator {
  private contract: Registry.Contract<PrivateState>;
  private state: ocrt.ChargedState;
  private effects: ocrt.Effects | undefined;
  private blockTime: number | undefined;
  private activeSecretKey: Uint8Array;

  readonly collateralAmount: bigint;
  readonly maxPeriod: bigint;

  private constructor(
    collateralAmount: bigint,
    maxPeriod: bigint,
    secretKey: Uint8Array,
    contract: Registry.Contract<PrivateState>,
    state: ocrt.ChargedState
  ) {
    this.collateralAmount = collateralAmount;
    this.maxPeriod = maxPeriod;
    this.activeSecretKey = secretKey;
    this.contract = contract;
    this.state = state;
  }

  static async create(collateralAmount: bigint, maxPeriod: bigint, secretKey: Uint8Array): Promise<RegistrySimulator> {
    const contract = new Registry.Contract(makeWitnesses(secretKey));
    const constructorCtx = createConstructorContext<PrivateState>({ secretKey }, DUMMY_COIN_PUBLIC_KEY);
    const result = await contract.initialState(constructorCtx, collateralAmount, maxPeriod);
    return new RegistrySimulator(collateralAmount, maxPeriod, secretKey, contract, result.currentContractState.data);
  }

  setBlockTime(secondsSinceEpoch: bigint): void {
    this.blockTime = Number(secondsSinceEpoch);
  }

  useKey(secretKey: Uint8Array): void {
    this.activeSecretKey = secretKey;
    this.contract = new Registry.Contract(makeWitnesses(secretKey));
  }

  register(entry: RegistryEntry) {
    const raw = entryToContract(entry);
    return this.run('registerServer', (ctx) => this.contract.impureCircuits.registerServer(ctx, raw));
  }

  deregister(key: Uint8Array, recipient?: { bytes: Uint8Array }) {
    const to = recipient ?? makeRecipient();
    return this.run('deregisterServer', (ctx) => this.contract.impureCircuits.deregisterServer(ctx, key, to));
  }

  renewRegistration(expiry: Date) {
    const seconds = BigInt(Math.floor(expiry.getTime() / 1000));
    return this.run('renewRegistration', (ctx) => this.contract.impureCircuits.renewRegistration(ctx, seconds));
  }

  getLedger(): Registry.Ledger {
    return Registry.ledger(this.state);
  }

  getEffects(): ocrt.Effects | undefined {
    return this.effects;
  }

  /** Runs one circuit from the current state, keeps the state it leaves, and returns its effects. */
  private async run(
    circuitId: string,
    call: (ctx: CircuitContext<PrivateState>) => Promise<{ context: CircuitContext<PrivateState> }>
  ): Promise<ocrt.Effects> {
    const context = createCircuitContext<PrivateState>({
      circuitId,
      contractAddress: CONTRACT_ADDRESS,
      coinPublicKeyOrZswapState: DUMMY_COIN_PUBLIC_KEY,
      contractState: this.state,
      privateState: { secretKey: this.activeSecretKey },
      time: this.blockTime,
    });
    const result = await call(context);
    const trace = result.context.callProofDataTrace;
    const finalQueryContext = trace[trace.length - 1].finalQueryContext;
    this.state = finalQueryContext.state;
    this.effects = finalQueryContext.effects;
    return finalQueryContext.effects;
  }
}

export function randomSecretKey(): Uint8Array {
  const key = new Uint8Array(64);
  crypto.getRandomValues(key);
  return key;
}
