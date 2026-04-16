import * as path from 'path';
import { fileURLToPath } from 'url';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as Counter from '../../../counter/out/contract/index.js';

export type CounterContract = Counter.Contract<undefined>;

const COUNTER_OUT_DIR = path.resolve(fileURLToPath(import.meta.url), '../../../../counter/out');

export const CompiledCounterContract = CompiledContract.make<CounterContract>('Counter', Counter.Contract).pipe(
  CompiledContract.withVacantWitnesses,
  CompiledContract.withCompiledFileAssets(COUNTER_OUT_DIR)
);

export { Counter };
