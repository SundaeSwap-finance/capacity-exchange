import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { witnesses, CircuitPrivateState } from './witnesses.js';
import { Contract } from '../../../token-mint/out/contract/index.js';

export type TokenMintContract = Contract<CircuitPrivateState>;

export const CompiledTokenMintContract = CompiledContract.make<TokenMintContract>('TokenMint', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('./token-mint/out')
);
