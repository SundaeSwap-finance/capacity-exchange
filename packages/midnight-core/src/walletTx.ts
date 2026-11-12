/**
 * Crossings between ledger-v9 transaction objects and the handles the wallet SDK and midnight-js
 * pass around. Both SDKs carry transactions as version-stamped handles so they can serve either
 * side of a hard fork; this codebase only builds ledger-v9 transactions, so every crossing is by
 * bytes into (and out of) ledger-v9.
 */
import {
  Transaction,
  type Binding,
  type FinalizedTransaction,
  type PreBinding,
  type PreProof,
  type Proof,
  type SignatureEnabled,
  type UnprovenTransaction,
} from '@midnightntwrk/ledger-v9';
import type { WalletFacade } from '@midnight-ntwrk/wallet-sdk/facade';
import type { FinalizedTx as WalletFinalizedTx, WalletTransaction } from '@midnight-ntwrk/wallet-sdk';
import { LedgerTransaction, type ProofProvider, type ProveTxConfig } from '@midnight-ntwrk/midnight-js/types';

/** A proven ledger-v9 transaction that has not been bound yet. */
export type UnboundTransaction = Transaction<SignatureEnabled, Proof, PreBinding>;

/** Anything that can write itself out as transaction bytes: a ledger object or either SDK's handle. */
interface Serializable {
  serialize(): Uint8Array;
}

/** Reads transaction bytes as a ledger-v9 unproven transaction. */
export const toUnproven = (tx: Serializable): UnprovenTransaction =>
  Transaction.deserialize<SignatureEnabled, PreProof, PreBinding>(
    'signature',
    'pre-proof',
    'pre-binding',
    tx.serialize()
  );

/** Reads transaction bytes as a ledger-v9 unbound (proven, pre-binding) transaction. */
export const toUnbound = (tx: Serializable): UnboundTransaction =>
  Transaction.deserialize<SignatureEnabled, Proof, PreBinding>('signature', 'proof', 'pre-binding', tx.serialize());

/** Reads transaction bytes as a ledger-v9 finalized transaction. */
export const toFinalized = (tx: Serializable): FinalizedTransaction =>
  Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', tx.serialize());

/** Hands a ledger-v9 transaction to the wallet at the protocol version the wallet is acting at. */
export const toWalletTx = <S extends WalletTransaction.Stage>(
  facade: WalletFacade,
  stage: S,
  tx: Serializable
): WalletTransaction<S> => facade.adoptTransaction(tx.serialize(), stage);

/** A midnight-js finalized handle for a wallet-finalized transaction. */
export const walletFinalizedToMidnight = (tx: WalletFinalizedTx) =>
  LedgerTransaction.fromBytes('v9', 'Finalized', tx.serialize());

/** Proves a ledger-v9 unproven transaction through a midnight-js ProofProvider. */
export async function proveV9(
  proofProvider: Pick<ProofProvider, 'proveTx'>,
  tx: UnprovenTransaction,
  config?: ProveTxConfig
): Promise<UnboundTransaction> {
  return toUnbound(await proofProvider.proveTx(LedgerTransaction.seal('v9', 'Unproven', tx), config));
}
