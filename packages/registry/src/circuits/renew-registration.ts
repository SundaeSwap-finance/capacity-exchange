import { AppContext, createLogger, submitStatefulCallTxDirect } from '@sundaeswap/capacity-exchange-nodejs';
import { RegistrySecretKey } from '../types.js';
import { CompiledRegistryContract } from '../contract.js';
import { getProviders } from '../utils.js';
import { toTxResult, TxResult } from '@sundaeswap/capacity-exchange-core';

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
  const { contractAddress, expiryInt } = params;

  logger.info(`Renewing registration...`);

  const { providers, privateStateId } = await getProviders(ctx, contractAddress, secretKey, logger);

  const result = await submitStatefulCallTxDirect(providers, {
    contractAddress,
    compiledContract: CompiledRegistryContract,
    circuitId: circuitId,
    privateStateId,
    args: [expiryInt],
  });

  return toTxResult(contractAddress, result.public);
}
