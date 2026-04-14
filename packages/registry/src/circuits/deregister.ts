import { AppContext, createLogger, submitStatefulCallTxDirect } from '@capacity-exchange/midnight-node';
import { toTxResult, TxResult } from '@capacity-exchange/midnight-core';
import { RegistryKey } from '../types';
import { CompiledRegistryContract, getProviders } from '../contract';
import { persistentHash, CompactTypeBytes, type CompactType } from '@midnight-ntwrk/compact-runtime';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import type { Value, Alignment } from '@midnight-ntwrk/onchain-runtime-v3';

const logger = createLogger(import.meta);

const circuitId = 'deregisterServer';

/** CompactType descriptor for Bytes<32> — copied from the index.js of registry contract */
const descriptor_1 = new CompactTypeBytes(32);

/** CompactType descriptor for Bytes<64> — copied from the index.js of registry contract */
const descriptor_0 = new CompactTypeBytes(64);

/**
 * In the registry contract, used as the input type for `persistentHash` in `hashKey`.
 */
const descriptor_12: CompactType<[Uint8Array, Uint8Array]> = {
  alignment(): Alignment {
    return descriptor_1.alignment().concat(descriptor_0.alignment());
  },
  fromValue(value_0: Value): [Uint8Array, Uint8Array] {
    return [descriptor_1.fromValue(value_0), descriptor_0.fromValue(value_0)];
  },
  toValue(value_0: [Uint8Array, Uint8Array]): Value {
    return descriptor_1.toValue(value_0[0]).concat(descriptor_0.toValue(value_0[1]));
  },
};

/**
 * `pad(32, "registry:pkh")` from the registry contract, converted to bytes.
 * Copied from `_hashKey_0` in the generated contract JS.
 */
const REGISTRY_PREFIX = new Uint8Array([
  114,
  101,
  103,
  105,
  115,
  116,
  114,
  121,
  58,
  112,
  107,
  104, // "registry:pkh"
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0, // padding to 32 bytes
]);

export interface DeregisterParams {
  contractAddress: string;

  privateStateId: string;
  /**
   * 64-byte secret key that determines the on-chain registry key via `hashKey(secretKey())`.
   * Must match the key used when registering.
   */
  secretKey: RegistryKey;
  /**
   * Bech32m-encoded unshielded address that will receive the collateral refund
   * sent by `sendUnshielded` in the `deregisterServer` circuit.
   */
  recipientAddress: string;
}

export async function deregister(ctx: AppContext, params: DeregisterParams): Promise<TxResult> {
  const { contractAddress, privateStateId, secretKey } = params;

  logger.info(`Deregistering from registry ${contractAddress}...`);

  const providers = await getProviders(ctx, contractAddress, privateStateId, secretKey, logger);

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
 * Replicates the `hashKey` circuit to compute the 32-byte registry key
 */
export function computeRegistryKey(secretKey: RegistryKey): Uint8Array {
  return persistentHash(descriptor_12, [REGISTRY_PREFIX, secretKey]);
}

/**
 * Parses a Midnight bech32m address string into the `{ bytes: Uint8Array }`
 * to represent the `UserAddress` argument.
 */
function parseAddress(address: string): { bytes: Uint8Array } {
  return { bytes: new Uint8Array(MidnightBech32m.parse(address).data) };
}
