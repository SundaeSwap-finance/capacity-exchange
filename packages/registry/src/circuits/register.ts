import { AppContext, createLogger, WalletContext } from '@capacity-exchange/midnight-node';
import { DEFAULT_TTL_MS, toTxResult } from '@capacity-exchange/midnight-core';
import { entryToContract, RegistryEntry, RegistrySecretKey } from '../types';
import { CompiledRegistryContract, getProviders } from '../contract.js';

import { SucceedEntirely, UnboundTransaction, type MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';

const logger = createLogger(import.meta);

type RegisterServerProvider = MidnightProviders<'registerServer'>;
const circuitId = 'registerServer';

export interface RegisterParams {
  contractAddress: string;
  privateStateId: string;
  /** Server entry to register (IP, port, validity expiry). */
  entry: RegistryEntry;
}

export async function register(ctx: AppContext, secretKey: RegistrySecretKey, params: RegisterParams) {
  const { contractAddress, privateStateId, entry } = params;

  logger.info(`Registering ${entry.ip.address}:${entry.port} to registry ${contractAddress}...`);

  const providers = await getProviders(ctx, contractAddress, privateStateId, secretKey, logger);

  const result = await _register(ctx.walletContext, providers as RegisterServerProvider, params);

  return toTxResult(contractAddress, result);
}

async function _register(walletContext: WalletContext, providers: RegisterServerProvider, params: RegisterParams) {
  const { contractAddress, privateStateId, entry } = params;

  const provenTx = await provenCallTx(providers, { contractAddress, privateStateId, entry });

  const txId = await submitUnboundTransaction(walletContext, provenTx);

  logger.info('Waiting for confirmation...');
  const txData = await providers.publicDataProvider.watchForTxData(txId);

  if (txData.status !== SucceedEntirely) {
    throw new Error(`RegisterServer transaction failed with status: ${txData.status}`);
  }

  return txData;
}

/**
 * Builds and proves the `registerServer` unproven call transaction.
 */
async function provenCallTx(providers: RegisterServerProvider, params: RegisterParams) {
  const { contractAddress, privateStateId, entry } = params;

  const callTxData = await createUnprovenCallTx(providers, {
    contractAddress,
    compiledContract: CompiledRegistryContract,
    circuitId,
    privateStateId,
    args: [entryToContract(entry)],
  });

  logger.info('Proving transaction (this may take several minutes)...');
  const provenTx = await providers.proofProvider.proveTx(callTxData.private.unprovenTx);

  return provenTx;
}

/**
 * Balances, signs, and submits a proven unbound transaction that includes a
 * `receiveUnshielded` call.
 *
 * @returns The submitted transaction ID as string.
 */
async function submitUnboundTransaction(walletContext: WalletContext, tx: UnboundTransaction) {
  const { walletFacade, keys } = walletContext;

  const ttl = new Date(Date.now() + DEFAULT_TTL_MS);

  logger.info('Balancing transaction...');
  const recipe = await walletFacade.balanceUnboundTransaction(
    tx,
    { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
    { ttl }
  );

  logger.info('Signing unshielded offer...');
  const signedRecipe = await walletFacade.signRecipe(recipe, (payload: Uint8Array) =>
    keys.unshieldedKeystore.signData(payload)
  );

  logger.info('Finalizing transaction...');
  const finalizedTx = await walletFacade.finalizeRecipe(signedRecipe);

  return await walletFacade.submitTransaction(finalizedTx);
}
