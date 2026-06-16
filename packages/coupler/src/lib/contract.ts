import * as path from 'path';
import { fileURLToPath } from 'url';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { witnesses, CircuitPrivateState } from './witnesses.js';
import { Contract } from '../../out/contract/index.js';

export type CouplerContract = Contract<CircuitPrivateState>;

export const COUPLER_OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../out');

export const CompiledCouplerContract = CompiledContract.make<CouplerContract>('Coupler', Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets(COUPLER_OUT_DIR)
);

export { Contract as CouplerRawContract };
export { ledger } from '../../out/contract/index.js';
