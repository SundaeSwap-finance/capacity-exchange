/**
 * Constructs synthetic "already synced" wallet state for new wallets by
 * combining pre-synced chain state snapshots with wallet-specific keys.
 *
 * The snapshots contain global Midnight chain state (Merkle trees, offsets)
 * that are identical for all wallets. We swap in the new wallet's keys
 * and set balances to empty, then pass to restore() instead of syncing
 * from genesis — the wallet only needs to catch up from the snapshot offset.
 */

import type { WalletKeys } from '@capacity-exchange/midnight-core';
import { PublicKey } from '@midnight-ntwrk/wallet-sdk-unshielded-wallet';

interface ChainSnapshot {
  shielded: { state: string; offset: string; protocolVersion: string };
  dust: { state: string; offset: string; protocolVersion: string };
  unshielded: { appliedId: string; protocolVersion: string };
}

let cached: Promise<ChainSnapshot | null> | null = null;

export function loadSnapshots(networkId: string): Promise<ChainSnapshot | null> {
  if (!cached) {
    cached = Promise.all([
      fetch(`/wallet-snapshots/${networkId}-shielded.json`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/wallet-snapshots/${networkId}-dust.json`).then((r) => (r.ok ? r.json() : null)),
      fetch(`/wallet-snapshots/${networkId}-unshielded.json`).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([shielded, dust, unshielded]) => {
        if (!shielded || !dust || !unshielded) {
          return null;
        }
        return { shielded, dust, unshielded } as ChainSnapshot;
      })
      .catch((err) => {
        console.warn('[WalletSnapshot] Failed to load:', err);
        cached = null;
        return null;
      });
  }
  return cached;
}

/**
 * Build serialized wallet state strings from snapshots + fresh wallet keys.
 * Returns the same JSON format that the SDK's serializeState() produces,
 * but with empty balances and the chain state from the snapshot.
 */
export function buildSyntheticState(
  snap: ChainSnapshot,
  keys: WalletKeys,
  networkId: string
): { savedShieldedState: string; savedDustState: string; savedUnshieldedState: string } {
  const savedShieldedState = JSON.stringify({
    publicKeys: {
      coinPublicKey: keys.shieldedSecretKeys.coinPublicKey,
      encryptionPublicKey: keys.shieldedSecretKeys.encryptionPublicKey,
    },
    state: snap.shielded.state,
    protocolVersion: snap.shielded.protocolVersion,
    offset: snap.shielded.offset,
    networkId,
    coinHashes: {},
  });

  const savedDustState = JSON.stringify({
    publicKey: { publicKey: keys.dustSecretKey.publicKey.toString() },
    state: snap.dust.state,
    protocolVersion: snap.dust.protocolVersion,
    networkId,
    offset: snap.dust.offset,
  });

  const unshieldedPub = PublicKey.fromKeyStore(keys.unshieldedKeystore);
  const savedUnshieldedState = JSON.stringify({
    publicKey: {
      publicKey: unshieldedPub.publicKey,
      addressHex: unshieldedPub.addressHex,
      address: unshieldedPub.address,
    },
    state: { availableUtxos: [], pendingUtxos: [] },
    protocolVersion: snap.unshielded.protocolVersion,
    appliedId: snap.unshielded.appliedId,
    networkId,
  });

  return { savedShieldedState, savedDustState, savedUnshieldedState };
}
