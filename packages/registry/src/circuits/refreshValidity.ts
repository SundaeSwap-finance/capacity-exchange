import { AppContext, createLogger, submitStatefulCallTxDirect } from '@capacity-exchange/midnight-node';
import { RegistrySecretKey } from '../types.js';
import { CompiledRegistryContract, getProviders } from '../contract.js';
import { toTxResult, TxResult } from '@capacity-exchange/midnight-core';

const logger = createLogger(import.meta);

const circuitId = 'refreshValidity';

export interface RefreshValidityParams {
  contractAddress: string;

  privateStateId: string;

  /**
   * New expiry as a Unix timestamp in seconds, passed directly to the `refreshValidity`
   * circuit as `UnixTimestampSeconds` (`Uint<64>`).
   */
  validToInt: bigint;

  /** New expiry date for the registry entry. Used only for logging. */
  validTo: Date;
}

/**
 * Extends the validity of an existing registry entry.
 *
 * Calls the `refreshValidity` circuit. The new timestamp must not exceed `maximumValidityInterval`.
 *
 * @returns A {@link TxResult} with the transaction ID, hash, contract address, and block info.
 */
export async function refreshValidity(
  ctx: AppContext,
  secretKey: RegistrySecretKey,
  params: RefreshValidityParams
): Promise<TxResult> {
  const { contractAddress, privateStateId, validTo } = params;

  logger.info(`Refreshing validity to ${validTo.toISOString()} in registry ${contractAddress}...`);

  const providers = await getProviders(ctx, contractAddress, privateStateId, secretKey, logger);

  const result = await submitStatefulCallTxDirect(providers, {
    contractAddress,
    compiledContract: CompiledRegistryContract,
    circuitId,
    privateStateId,
    args: [params.validToInt],
  });

  return toTxResult(contractAddress, result.public);
}
