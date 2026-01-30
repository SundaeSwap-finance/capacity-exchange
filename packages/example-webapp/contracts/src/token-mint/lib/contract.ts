import { witnesses, CircuitPrivateState } from './witnesses.js';
import { Contract, Witnesses } from '../../../token-mint/out/contract/index.js';

export type TokenMintContract = Contract<CircuitPrivateState, Witnesses<CircuitPrivateState>>;

export function createTokenMintContract(): TokenMintContract {
  return new Contract(witnesses);
}
