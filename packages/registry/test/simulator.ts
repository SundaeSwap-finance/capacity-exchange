import {
  createConstructorContext,
  createCircuitContext,
  emptyZswapLocalState,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import * as ocrt from '@midnight-ntwrk/onchain-runtime-v3';
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

export class RegistrySimulator {
  private contract: Registry.Contract<PrivateState>;
  private context: CircuitContext<PrivateState>;
  private activeSecretKey: Uint8Array;

  readonly collateralAmount: bigint;
  readonly maxValidityInterval: bigint;

  constructor(
    collateralAmount: bigint,
    maxValidityInterval: bigint,
    secretKey: Uint8Array,
  ) {
    this.collateralAmount = collateralAmount;
    this.maxValidityInterval = maxValidityInterval;
    this.activeSecretKey = secretKey;

    this.contract = new Registry.Contract(makeWitnesses(secretKey));

    const constructorCtx = createConstructorContext<PrivateState>(
      { secretKey },
      DUMMY_COIN_PUBLIC_KEY,
    );

    const result = this.contract.initialState(
      constructorCtx,
      collateralAmount,
      maxValidityInterval,
    );

    this.context = createCircuitContext(
      ocrt.dummyContractAddress(),
      result.currentZswapLocalState.coinPublicKey,
      result.currentContractState,
      result.currentPrivateState,
    );
  }

  setBlockTime(secondsSinceEpoch: bigint): void {
    this.context.currentQueryContext.block = {
      ...this.context.currentQueryContext.block,
      secondsSinceEpoch,
      secondsSinceEpochErr: 0,
    };
  }

  useKey(secretKey: Uint8Array): void {
    this.activeSecretKey = secretKey;
    this.contract = new Registry.Contract(makeWitnesses(secretKey));
  }

  register(entry: RegistryEntry) {
    const raw = entryToContract(entry);
    const result = this.contract.impureCircuits.registerServer(this.context, raw);
    const effects = result.context.currentQueryContext.effects;
    this.syncContext(result.context);
    return effects;
  }

  deregister(key: Uint8Array, recipient?: { bytes: Uint8Array }) {
    const result = this.contract.impureCircuits.deregisterServer(
      this.context,
      key,
      recipient ?? makeRecipient(),
    );
    const effects = result.context.currentQueryContext.effects;
    this.syncContext(result.context);
    return effects;
  }

  refresh(validTo: Date) {
    const result = this.contract.impureCircuits.refreshValidity(
      this.context,
      BigInt(Math.floor(validTo.getTime() / 1000)),
    );
    const effects = result.context.currentQueryContext.effects;
    this.syncContext(result.context);
    return effects;
  }

  getLedger(): Registry.Ledger {
    return Registry.ledger(this.context.currentQueryContext.state);
  }

  getEffects() {
    return this.context.currentQueryContext.effects;
  }

  private syncContext(context: CircuitContext<PrivateState>): void {
    this.context = {
      ...context,
      currentPrivateState: { secretKey: this.activeSecretKey },
      currentZswapLocalState: emptyZswapLocalState(DUMMY_COIN_PUBLIC_KEY),
    };
  }
}

export function randomSecretKey(): Uint8Array {
  const key = new Uint8Array(64);
  crypto.getRandomValues(key);
  return key;
}
