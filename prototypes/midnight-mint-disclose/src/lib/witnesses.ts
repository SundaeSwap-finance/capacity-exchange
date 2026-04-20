import type { Witnesses } from '../../out/contract/index.js';

/**
 * No private state is required: `s` is now a public circuit argument, not a
 * witness. The empty record/object are kept so the contract harness still
 * has a `Witnesses<PS>` and `CircuitPrivateState` to thread through.
 */
export type CircuitPrivateState = Record<string, never>;

export const createPrivateState = (): CircuitPrivateState => ({});

export const witnesses: Witnesses<CircuitPrivateState> = {};
