import {
  createConstructorContext,
  createCircuitContext,
  type CircuitContext,
} from '@midnight-ntwrk/compact-runtime';
import * as ocrt from '@midnight-ntwrk/onchain-runtime-v3';
import * as Registry from '../contract/out/contract/index.js';
import type { Witnesses } from '../contract/out/contract/index.js';
import { entryToContract, type RegistryEntry } from '../src/types.js';

const DUMMY_COIN_PUBLIC_KEY = '0'.repeat(64);

type PrivateState = {
  secretKey: Uint8Array;
};

function makeWitnesses(secretKey: Uint8Array): Witnesses<PrivateState> {
  return {
    secretKey: ({ privateState }) => [privateState, secretKey],
  };
}

function makeRecipient(): { bytes: Uint8Array } {
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

  register(entry: RegistryEntry): void {
    const raw = entryToContract(entry);
    const result = this.contract.impureCircuits.registerServer(this.context, raw);
    this.syncContext(result.context);
  }

  deregister(key: Uint8Array, recipient?: { bytes: Uint8Array }): void {
    const result = this.contract.impureCircuits.deregisterServer(
      this.context,
      key,
      recipient ?? makeRecipient(),
    );
    this.syncContext(result.context);
  }

  refresh(validTo: Date): void {
    const result = this.contract.impureCircuits.refreshValidity(
      this.context,
      BigInt(Math.floor(validTo.getTime() / 1000)),
    );
    this.syncContext(result.context);
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
    };
  }
}

export function randomSecretKey(): Uint8Array {
  const key = new Uint8Array(64);
  crypto.getRandomValues(key);
  return key;
}
