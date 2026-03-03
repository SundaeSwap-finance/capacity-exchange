import { type WalletFacade, FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';
import type { WalletKeys } from '@capacity-exchange/midnight-core';
import { DEFAULT_TTL_MS, waitForState } from '@capacity-exchange/midnight-core';
import { createLogger } from '@capacity-exchange/midnight-node';

const logger = createLogger(import.meta);

async function registerCoinsForDust(
  coins: FacadeState['unshielded']['availableCoins'],
  dustAddress: string,
  walletFacade: WalletFacade,
  keys: WalletKeys
): Promise<void> {
  const recipe = await walletFacade.registerNightUtxosForDustGeneration(
    coins,
    keys.unshieldedKeystore.getPublicKey(),
    (payload) => keys.unshieldedKeystore.signData(payload),
    dustAddress
  );
  // Registration transactions pay fees from generated dust — no separate fee balancing needed.
  const finalized = await walletFacade.finalizeRecipe(recipe);
  await walletFacade.submitTransaction(finalized);
}

/** Register all unregistered UTxOs for dust generation in a single batched tx. */
export async function registerAllForDust(
  state: FacadeState,
  walletFacade: WalletFacade,
  keys: WalletKeys
): Promise<void> {
  const nightUtxos = state.unshielded.availableCoins.filter((coin) => !coin.meta.registeredForDustGeneration);

  if (state.unshielded.availableCoins.length === 0) {
    throw new Error('No unshielded NIGHT UTXOs available — fund the wallet first');
  }

  if (nightUtxos.length === 0) {
    logger.info('All NIGHT UTXOs already registered');
    return;
  }

  const dustAddress = state.dust.dustAddress;
  logger.info(`Registering ${nightUtxos.length} NIGHT UTXO(s) for dust generation to ${dustAddress}...`);
  await registerCoinsForDust(nightUtxos, dustAddress, walletFacade, keys);
  logger.info('Registration submitted');
}

/** Register unregistered UTxOs one-at-a-time to avoid consolidation into a single UTxO. */
export async function registerEachForDust(
  state: FacadeState,
  walletFacade: WalletFacade,
  keys: WalletKeys
): Promise<void> {
  const unregistered = state.unshielded.availableCoins.filter((c) => !c.meta.registeredForDustGeneration);
  if (unregistered.length === 0) {
    logger.info('All UTxOs already registered');
    return;
  }

  // Register one UTxO at a time to avoid consolidation (the registration tx
  // spends+recreates UTxOs, so batching merges them together).
  const dustAddress = state.dust.dustAddress;
  for (let i = 0; i < unregistered.length; i++) {
    logger.info(`Registering UTxO ${i + 1}/${unregistered.length} for dust generation...`);
    await registerCoinsForDust([unregistered[i]], dustAddress, walletFacade, keys);
  }
  logger.info(`All ${unregistered.length} UTxO(s) registered`);
}

/** Wait for the wallet's dust balance to become positive. Returns the synced state. */
export async function waitForDustBalance(walletFacade: WalletFacade): Promise<FacadeState> {
  logger.info('Waiting for dust to generate...');
  const state = await waitForState(walletFacade.state(), (s) => s.dust.walletBalance(new Date()) > 0n);
  logger.info('Dust tokens available');
  return state;
}

/** Deregister all dust-registered UTxOs in a single tx (requires fee balancing). No-op if none registered. */
export async function deregisterAllFromDust(
  state: FacadeState,
  walletFacade: WalletFacade,
  keys: WalletKeys
): Promise<void> {
  const registered = state.unshielded.availableCoins.filter((c) => c.meta.registeredForDustGeneration);
  if (registered.length === 0) {
    logger.info('No dust-registered UTxOs to deregister');
    return;
  }

  logger.info(`Deregistering ${registered.length} NIGHT UTxO(s) from dust generation...`);
  const recipe = await walletFacade.deregisterFromDustGeneration(
    registered,
    keys.unshieldedKeystore.getPublicKey(),
    (payload) => keys.unshieldedKeystore.signData(payload)
  );

  // Deregistration recipes need fee balancing before submission
  const ttl = new Date(Date.now() + DEFAULT_TTL_MS);
  const { shieldedSecretKeys, dustSecretKey } = keys;
  const balancedRecipe = await walletFacade.balanceUnprovenTransaction(
    recipe.transaction,
    { shieldedSecretKeys, dustSecretKey },
    { ttl }
  );

  const finalized = await walletFacade.finalizeRecipe(balancedRecipe);
  await walletFacade.submitTransaction(finalized);
  logger.info('Deregistration submitted');
}
