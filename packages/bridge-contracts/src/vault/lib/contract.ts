import { CompiledContract } from '@midnight-ntwrk/compact-js';
import * as Vault from '../../../vault/out/contract/index.js';
import { witnesses, CircuitPrivateState } from './witnesses.js';

export type VaultContract = Vault.Contract<CircuitPrivateState>;

export const CompiledVaultContract = CompiledContract.make<VaultContract>('Vault', Vault.Contract).pipe(
  CompiledContract.withWitnesses(witnesses),
  CompiledContract.withCompiledFileAssets('./vault/out')
);

export { Vault };
