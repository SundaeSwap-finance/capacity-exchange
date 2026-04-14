import type { WalletKeys } from './keys.js';
import { PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';
import type { SavedWalletState } from './walletStateStore.js';

export interface ChainSnapshot {
  shielded: { state: string; offset: string; protocolVersion: string };
  dust: { state: string; offset: string; protocolVersion: string };
  unshielded: { appliedId: string; protocolVersion: string };
}

/** Build synthetic wallet state from chain snapshots + wallet keys, with empty balances. */
export function buildSyntheticWalletState(
  snapshot: ChainSnapshot,
  keys: WalletKeys,
  networkId: string
): SavedWalletState {
  const savedShieldedState = JSON.stringify({
    publicKeys: {
      coinPublicKey: keys.shieldedSecretKeys.coinPublicKey,
      encryptionPublicKey: keys.shieldedSecretKeys.encryptionPublicKey,
    },
    state: snapshot.shielded.state,
    protocolVersion: snapshot.shielded.protocolVersion,
    offset: snapshot.shielded.offset,
    networkId,
    coinHashes: {},
  });

  const savedDustState = JSON.stringify({
    publicKey: { publicKey: keys.dustSecretKey.publicKey.toString() },
    state: snapshot.dust.state,
    protocolVersion: snapshot.dust.protocolVersion,
    networkId,
    offset: snapshot.dust.offset,
  });

  const unshieldedPub = PublicKey.fromKeyStore(keys.unshieldedKeystore);
  const savedUnshieldedState = JSON.stringify({
    publicKey: {
      publicKey: unshieldedPub.publicKey,
      addressHex: unshieldedPub.addressHex,
      address: unshieldedPub.address,
    },
    state: { availableUtxos: [], pendingUtxos: [] },
    protocolVersion: snapshot.unshielded.protocolVersion,
    appliedId: snapshot.unshielded.appliedId,
    networkId,
  });

  return { savedShieldedState, savedDustState, savedUnshieldedState };
}

/** Extract chain-only state from serialized wallet state, stripping wallet-specific keys and balances. */
export function extractChainSnapshot(saved: SavedWalletState): ChainSnapshot {
  const shielded = JSON.parse(saved.savedShieldedState!);
  const dust = JSON.parse(saved.savedDustState!);
  const unshielded = JSON.parse(saved.savedUnshieldedState!);

  return {
    shielded: {
      state: shielded.state,
      offset: shielded.offset,
      protocolVersion: shielded.protocolVersion,
    },
    dust: {
      state: dust.state,
      offset: dust.offset,
      protocolVersion: dust.protocolVersion,
    },
    unshielded: {
      appliedId: unshielded.appliedId,
      protocolVersion: unshielded.protocolVersion,
    },
  };
}
