import { AppContext, createLogger, submitStatefulCallTxDirect } from '@capacity-exchange/midnight-node';
import { toTxResult, TxResult } from '@capacity-exchange/midnight-core';
import { generateRandomSecretKey } from '../types.js';
import { CompiledRegistryContract, getProviders } from '../contract.js';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import { circuitId } from './deregister.js';

const logger = createLogger(import.meta);

export interface ClaimExpiredParams {
  contractAddress: string;
  /**
   * 32-byte on-chain registry key of the expired entry to remove.
   */
  registryKey: Uint8Array;
  /**
   * Bech32m-encoded unshielded address that will receive the collateral refund.
   */
  recipientAddress: string;
}

/**
 * Claims the collateral from an expired registry entry.
 *
 * Calls `deregisterServer` without a secret key. This succeeds only when the
 * entry's `expiry` has passed — the contract's ownership check is skipped for
 * expired entries so no secret key is needed.
 *
 * @returns A {@link TxResult} with the transaction ID, hash, contract address, and block info.
 */
export async function claimExpired(ctx: AppContext, params: ClaimExpiredParams): Promise<TxResult> {
  const { contractAddress, registryKey } = params;

  logger.info(`Claiming expired entry ${Buffer.from(registryKey).toString('hex')} from registry ${contractAddress}...`);

  // A dummy secret key is required to satisfy getProviders, but the secretKey()
  // witness is never invoked for expired entries (it is guarded by blockTimeLt).
  const dummySecretKey = generateRandomSecretKey();
  const { providers, privateStateId } = await getProviders(ctx, contractAddress, dummySecretKey, logger);

  const recipient = { bytes: new Uint8Array(MidnightBech32m.parse(params.recipientAddress).data) };

  const result = await submitStatefulCallTxDirect(providers, {
    contractAddress,
    compiledContract: CompiledRegistryContract,
    circuitId,
    privateStateId,
    args: [registryKey, recipient],
  });

  return toTxResult(contractAddress, result.public);
}
