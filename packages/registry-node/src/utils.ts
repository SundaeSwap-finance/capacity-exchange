import * as crypto from 'crypto';
import * as fs from 'fs';

import { AppContext, buildProviders } from '@sundaeswap/capacity-exchange-nodejs';
import type { Logger } from '@sundaeswap/capacity-exchange-core';
import {
  createPrivateState,
  type RegistryContract,
  type RegistrySecretKey,
} from '@sundaeswap/capacity-exchange-registry';
import { getContractOutDir } from '@sundaeswap/capacity-exchange-registry/node';

const SECRET_KEY_BYTES = 64;

/**
 * Reads a hex-encoded secret key from a file, validating that it contains exactly 64 bytes.
 */
export function readSecretKeyFile(filePath: string): RegistrySecretKey {
  const hexStr = fs.readFileSync(filePath, 'utf-8').trim();
  const bytes = new Uint8Array(Buffer.from(hexStr, 'hex'));
  if (bytes.length !== SECRET_KEY_BYTES) {
    throw new Error(
      `Invalid secret key in "${filePath}": expected ${SECRET_KEY_BYTES} bytes (${SECRET_KEY_BYTES * 2} hex chars), got ${bytes.length}`
    );
  }
  return bytes;
}

export async function getProviders(
  ctx: AppContext,
  contractAddress: string,
  secretKey: RegistrySecretKey,
  logger: Logger
) {
  const privateStateId = crypto.randomBytes(32).toString('hex');
  logger.debug(`generated private state id: ${privateStateId}`);

  const providers = buildProviders<RegistryContract>(ctx, getContractOutDir(logger));
  providers.privateStateProvider.setContractAddress(contractAddress);

  // Load the secret key into the private state provider so the `secretKey()` witness
  // has a value to read during circuit execution.
  await providers.privateStateProvider.set(privateStateId, createPrivateState(secretKey));

  return { providers, privateStateId };
}
