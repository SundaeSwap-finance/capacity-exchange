import * as path from 'path';
import { fileURLToPath } from 'url';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { witnesses, CircuitPrivateState } from './witnesses.js';
import { Contract } from '../../../token-mint/out/contract/index.js';

export type TokenMintContract = Contract<CircuitPrivateState>;

const TOKEN_MINT_OUT_DIR = path.resolve(fileURLToPath(import.meta.url), '../../../../token-mint/out');

export const CompiledTokenMintContract = CompiledContract.make<TokenMintContract>('TokenMint', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(TOKEN_MINT_OUT_DIR)
);
