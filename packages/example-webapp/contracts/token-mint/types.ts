import { CircuitPrivateState, witnesses } from './witnesses.js';
import * as CompiledVault from './out/contract/index.js';
import type { FoundContract } from '@midnight-ntwrk/midnight-js-contracts';
import type {
  CircuitParameters,
  ImpureCircuitId,
  MidnightProviders,
} from '@midnight-ntwrk/midnight-js-types';

export type Contract = CompiledVault.Contract<CircuitPrivateState>;

export type DeployedContract = FoundContract<Contract>;

export type Circuits = ImpureCircuitId<Contract>;

export type CirucitParamters<ICK extends Circuits> = CircuitParameters<Contract, ICK>;

export const cirucitPrivateStateId = 'mintingPrivateStateId';

export type CircuitProviders = MidnightProviders<
  Circuits,
  typeof cirucitPrivateStateId,
  CircuitPrivateState
>;

export const createContractInstance = (): Contract => new CompiledVault.Contract(witnesses);
