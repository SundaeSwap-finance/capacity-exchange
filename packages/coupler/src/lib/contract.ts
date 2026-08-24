import { CircuitPrivateState } from './witnesses.js';
import { Contract } from '../../out/contract/index.js';

export type CouplerContract = Contract<CircuitPrivateState>;

export { Contract as CouplerRawContract };
export { ledger } from '../../out/contract/index.js';
