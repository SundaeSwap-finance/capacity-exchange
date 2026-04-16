import { AppContext, createLogger, submitStatefulCallTxDirect } from '@capacity-exchange/midnight-node';
import { RegistrySecretKey } from '../types.js';
import { CompiledRegistryContract, getProviders } from '../contract.js';
import { toTxResult, TxResult } from '@capacity-exchange/midnight-core';

const logger = createLogger(import.meta);

/** On-chain circuit name in the Compact contract — do not change. */
const circuitId = 'renewRegistration';

export interface RenewRegistrationParams {
  contractAddress: string;

  /**
   * New expiry as a Unix timestamp in seconds, passed directly to the on-chain
   * `renewRegistration` circuit as `UnixTimestampSeconds` (`Uint<64>`).
   */
  expiryInt: bigint;

  /** New expiry date for the registry entry. Used only for logging. */
  expiry: Date;
}

/**
 * Renews an existing registry entry by extending its expiry.
 *
 * This is the TypeScript counterpart of the `renewRegistration` circuit in
 * `registry.compact`. The new expiry must not exceed `maximumRegistrationPeriod`
 * ahead of the current block time.
 *
 * @returns A {@link TxResult} with the transaction ID, hash, contract address, and block info.
 */
export async function renewRegistration(
  ctx: AppContext,
  secretKey: RegistrySecretKey,
  params: RenewRegistrationParams
): Promise<TxResult> {
  const { contractAddress, expiry } = params;

  logger.info(`Renewing registration to ${expiry.toISOString()} in registry ${contractAddress}...`);

  const { providers, privateStateId } = await getProviders(ctx, contractAddress, secretKey, logger);

  const result = await submitStatefulCallTxDirect(providers, {
    contractAddress,
    compiledContract: CompiledRegistryContract,
    circuitId: circuitId,
    privateStateId,
    args: [params.expiryInt],
  });

  return toTxResult(contractAddress, result.public);
}
