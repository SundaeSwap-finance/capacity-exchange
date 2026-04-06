import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as Counter from '../../../counter/out/contract/index.js';

export type CounterContract = Counter.Contract<undefined>;

export const CompiledCounterContract = CompiledContract.make<CounterContract>('Counter', Counter.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets('./counter/out')
);

export { Counter };
