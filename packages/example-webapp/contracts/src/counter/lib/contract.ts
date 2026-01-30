import * as Counter from '../../../counter/out/contract/index.js';

// Counter contract has no private state, so witnesses is empty
const witnesses: Counter.Witnesses<undefined> = {};

export type CounterContract = Counter.Contract<undefined, Counter.Witnesses<undefined>>;

export function createCounterContract(): CounterContract {
  return new Counter.Contract(witnesses);
}

export { Counter };
