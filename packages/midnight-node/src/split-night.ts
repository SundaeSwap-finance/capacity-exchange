import * as Rx from 'rxjs';
import { type WalletFacade, type FacadeState, type TokenTransfer } from '@midnight-ntwrk/wallet-sdk-facade';
import { MidnightBech32m, type UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import type { WalletKeys } from '@capacity-exchange/midnight-core';
import { sendUnshieldedTokens, waitForState } from '@capacity-exchange/midnight-core';
import { createLogger } from './createLogger.js';
import { deregisterAllFromDust, registerEachForDust } from './dust-registration.js';

const NIGHT_TOKEN_TYPE = '0000000000000000000000000000000000000000000000000000000000000000';

const logger = createLogger(import.meta);

export interface SplitNightOutput {
  splitTxHash: string;
  utxoCount: number;
  amountPerUtxo: string;
}

function getNightBalance(state: FacadeState): bigint {
  const balance = state.unshielded.balances[NIGHT_TOKEN_TYPE] ?? 0n;
  logger.info(`Unshielded NIGHT balance: ${balance}`);
  if (balance <= 0n) {
    throw new Error('No unshielded NIGHT balance to split');
  }
  return balance;
}

function buildSplitOutputs(
  balance: bigint,
  count: number,
  address: UnshieldedAddress
): { amountPerUtxo: bigint; outputs: TokenTransfer<UnshieldedAddress>[] } {
  const amountPerUtxo = balance / BigInt(count);
  if (amountPerUtxo <= 0n) {
    throw new Error(`Balance ${balance} too small to split into ${count} UTxOs`);
  }
  // Send count-1 explicit outputs; the wallet balancer creates change as the Nth UTxO.
  const outputs = Array.from({ length: count - 1 }, () => ({
    type: NIGHT_TOKEN_TYPE,
    receiverAddress: address,
    amount: amountPerUtxo,
  }));
  return { amountPerUtxo, outputs };
}

function allDeregistered(s: FacadeState): boolean {
  return s.unshielded.availableCoins.every((c) => !c.meta.registeredForDustGeneration);
}

function hasUtxoCount(count: number): (s: FacadeState) => boolean {
  return (s) => s.unshielded.availableCoins.length >= count;
}

/** Deregister from dust, split NIGHT into `count` UTxOs, and re-register each for dust. */
export async function splitAndRegister(
  walletFacade: WalletFacade,
  keys: WalletKeys,
  networkId: string,
  count: number
): Promise<SplitNightOutput> {
  if (!Number.isInteger(count) || count < 2) {
    throw new Error('count must be an integer >= 2');
  }
  // Single shared subscription — state updates flow through as txs land on-chain.
  const state$ = walletFacade.state().pipe(Rx.shareReplay({ bufferSize: 1, refCount: true }));

  let state = await waitForState(state$);
  logger.info(`Synced: ${state.unshielded.availableCoins.length} UTxO(s)`);

  // Deregister from dust generation
  await deregisterAllFromDust(state, walletFacade, keys);
  state = await waitForState(state$, allDeregistered);

  // Split NIGHT into N UTxOs
  const balance = getNightBalance(state);
  const address = state.unshielded.address;
  const { amountPerUtxo, outputs } = buildSplitOutputs(balance, count, address);
  logger.info(
    `Splitting: ${outputs.length} explicit outputs of ${amountPerUtxo} + remainder as change at ${MidnightBech32m.encode(networkId, address).asString()}`
  );
  const splitTxHash = await sendUnshieldedTokens(walletFacade, keys, outputs);
  logger.info(`Split transaction submitted: ${splitTxHash}`);
  state = await waitForState(state$, hasUtxoCount(count));
  logger.info(`Split confirmed: ${state.unshielded.availableCoins.length} UTxO(s)`);

  // Re-register all UTxOs for dust generation
  await registerEachForDust(state, walletFacade, keys);

  return { splitTxHash, utxoCount: count, amountPerUtxo: amountPerUtxo.toString() };
}
