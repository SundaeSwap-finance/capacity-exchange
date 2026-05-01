import { AppContext, createLogger, submitStatefulCallTxDirect } from '@sundaeswap/capacity-exchange-nodejs';
import { toTxResult, TxResult } from '@sundaeswap/capacity-exchange-core';
import { RegistrySecretKey } from '../types.js';
import { CompiledRegistryContract } from '../contract.js';
import { getProviders } from '../utils.js';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import { computeRegistryKey } from '../compact-types.js';

const logger = createLogger(import.meta);

export const circuitId = 'deregisterServer';
export interface DeregisterParams {
  contractAddress: string;
  /**
   * 64-byte secret key that determines the on-chain registry key via `hashKey(secretKey())`.
   * Must match the key used when registering.
   */
  secretKey: RegistrySecretKey;
  /**
   * Bech32m-encoded unshielded address that will receive the collateral refund
   * sent by `sendUnshielded` in the `deregisterServer` circuit.
   */
  recipientAddress: string;
}

export async function deregister(ctx: AppContext, params: DeregisterParams): Promise<TxResult> {
  const { contractAddress, secretKey } = params;

  logger.info(`Deregistering from registry ${contractAddress}...`);

  const { providers, privateStateId } = await getProviders(ctx, contractAddress, secretKey, logger);

  const registryKey = computeRegistryKey(secretKey);
  logger.info(`Registry key: ${Buffer.from(registryKey).toString('hex')}`);

  const recipient = parseAddress(params.recipientAddress);
  logger.info(`Recipient address: ${Buffer.from(recipient.bytes).toString('hex')}`);

  const result = await submitStatefulCallTxDirect(providers, {
    contractAddress,
    compiledContract: CompiledRegistryContract,
    circuitId,
    privateStateId,
    args: [registryKey, recipient],
  });

  return toTxResult(contractAddress, result.public);
}

/**
 * Parses a Midnight bech32m address string into the `{ bytes: Uint8Array }`
 * to represent the `UserAddress` argument.
 */
function parseAddress(address: string): { bytes: Uint8Array } {
  return { bytes: new Uint8Array(MidnightBech32m.parse(address).data) };
}
