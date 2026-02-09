import type { ProofProvider, ZKConfig } from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import {
  Transaction,
  type SignatureEnabled,
  type Proof,
  type PreBinding,
  type Binding,
  type UnprovenTransaction,
} from '@midnight-ntwrk/ledger-v6';
import type { Offer } from './types';
import { hexToUint8Array, uint8ArrayToHex } from './utils';

/**
 * Processes the user transaction with the confirmed offer.
 * Deserializes, proves, merges, and balances the transactions.
 */
export async function processTransactionWithOffer(
  tx: UnprovenTransaction,
  offer: Offer,
  proofProvider: ProofProvider<string>,
  connectedAPI: ConnectedAPI,
  zkConfig: ZKConfig<string>
) {
  console.debug('[CapacityExchange] Processing transaction for offer:', offer.offerId);
  const txBytes = hexToUint8Array(offer.serializedTx);
  const dustTx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
    'signature',
    'proof',
    'pre-binding',
    txBytes
  ).bind();
  console.debug('[CapacityExchange] DUST transaction deserialized');

  console.debug('[CapacityExchange] Proving user transaction');
  const provenTx = (await proofProvider.proveTx(tx, { zkConfig })).bind();
  console.debug('[CapacityExchange] User transaction proven');

  console.debug('[CapacityExchange] Merging transactions');
  const mergedTx = provenTx.merge(dustTx);
  const serializedStr = uint8ArrayToHex(mergedTx.serialize());
  console.debug('[CapacityExchange] Transactions merged, calling wallet to balance and seal');

  const result = await connectedAPI.balanceSealedTransaction(serializedStr);
  console.debug('[CapacityExchange] Wallet balanced and sealed transaction');

  const resultBytes = hexToUint8Array(result.tx);
  const transaction = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    'signature',
    'proof',
    'binding',
    resultBytes
  ).bind();

  console.debug('[CapacityExchange] Transaction processing complete');
  return {
    transaction,
    type: 'NothingToProve' as const,
  };
}
