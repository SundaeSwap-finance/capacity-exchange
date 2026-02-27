import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as Poc from '../contract/out/contract/index.js';

export type PocContract = Poc.Contract<undefined>;

export const CompiledPocContract = CompiledContract.make<PocContract>('Poc', Poc.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets('./contract/out')
);

export { Poc };
