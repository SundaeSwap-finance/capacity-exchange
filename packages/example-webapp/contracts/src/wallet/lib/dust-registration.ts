import * as Rx from 'rxjs';
import { type WalletFacade, FacadeState } from '@midnight-ntwrk/wallet-sdk-facade';
import type { WalletKeys } from '@capacity-exchange/core';
import { createLogger } from '@capacity-exchange/core/node';

const logger = createLogger(import.meta);

async function submitDustRegistration(state: FacadeState, walletFacade: WalletFacade, keys: WalletKeys): Promise<void> {
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
  const recipe = await walletFacade.registerNightUtxosForDustGeneration(
    nightUtxos,
    keys.unshieldedKeystore.getPublicKey(),
    (payload) => keys.unshieldedKeystore.signData(payload),
    dustAddress
  );
  const finalized = await walletFacade.finalizeRecipe(recipe);
  await walletFacade.submitTransaction(finalized);
  logger.info('Registration submitted');
}

async function waitForDustBalance(walletFacade: WalletFacade): Promise<FacadeState> {
  logger.info('Waiting for dust to generate...');
  const state = await Rx.firstValueFrom(
    walletFacade.state().pipe(
      Rx.throttleTime(5_000),
      Rx.filter((s) => s.isSynced),
      Rx.filter((s) => s.dust.walletBalance(new Date()) > 0n)
    )
  );
  logger.info('Dust tokens available');
  return state;
}

export async function registerForDust(
  state: FacadeState,
  walletFacade: WalletFacade,
  keys: WalletKeys
): Promise<FacadeState> {
  await submitDustRegistration(state, walletFacade, keys);
  return waitForDustBalance(walletFacade);
}
