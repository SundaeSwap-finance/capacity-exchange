import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { witnesses, CircuitPrivateState } from './witnesses.js';
import { Contract } from '../../out/contract/index.js';

export type MintDiscloseContract = Contract<CircuitPrivateState>;

export const CompiledMintDiscloseContract = CompiledContract.make<MintDiscloseContract>('MintDisclose', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('./out')
);
