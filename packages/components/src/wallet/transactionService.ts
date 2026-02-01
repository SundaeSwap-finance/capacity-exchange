import type { ProofProvider, ZKConfig } from '@midnight-ntwrk/midnight-js-types';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import {
  Transaction,
  type SignatureEnabled,
  type Proof,
  type PreBinding,
  type Binding,
  type UnprovenTransaction,
  type TokenType,
} from '@midnight-ntwrk/ledger-v6';
import type { Offer } from './types';
import { hexToUint8Array, uint8ArrayToHex } from './utils';

/**
 * Helper to log transaction imbalances for debugging.
 */
function logTransactionImbalances(label: string, tx: { imbalances: (segment: number) => Map<TokenType, bigint> }) {
  for (const segment of [0, 1]) {
    try {
      const imbalances = tx.imbalances(segment);
      if (imbalances.size > 0) {
        console.debug(`[CapacityExchange] ${label} imbalances (segment ${segment}):`);
        imbalances.forEach((value, key) => {
          console.debug(`  ${JSON.stringify(key)}: ${value.toString()}`);
        });
      } else {
        console.debug(`[CapacityExchange] ${label} imbalances (segment ${segment}): none`);
      }
    } catch (e) {
      console.debug(`[CapacityExchange] ${label} imbalances (segment ${segment}): error - ${e}`);
    }
  }
}

/**
 * Processes the user transaction with the confirmed offer.
 * Deserializes, proves, merges, and balances the transactions.
 */
export async function processTransactionWithOffer(
  tx: UnprovenTransaction,
  offer: Offer,
  proofProvider: ProofProvider<string>,
  connectedAPI: ConnectedAPI,
  zkConfig?: ZKConfig<string>
) {
  console.debug('[CapacityExchange] ========== Processing Transaction with Offer ==========');
  console.debug('[CapacityExchange] Offer ID:', offer.offerId);
  console.debug('[CapacityExchange] Offer amount:', offer.offerAmount, offer.offerCurrency);
  console.debug('[CapacityExchange] Offer expires at:', offer.expiresAt.toISOString());
  console.debug('[CapacityExchange] zkConfig provided:', !!zkConfig);
  if (zkConfig) {
    console.debug('[CapacityExchange] zkConfig circuitId:', zkConfig.circuitId);
  }

  // Log user transaction imbalances before proving
  console.debug('[CapacityExchange] User tx (unproven) identifiers:', tx.identifiers());
  logTransactionImbalances('User tx (unproven)', tx);

  console.debug('[CapacityExchange] Step 1: Deserializing DUST transaction from offer');
  console.debug('[CapacityExchange] Serialized tx length:', offer.serializedTx.length);
  const txBytes = hexToUint8Array(offer.serializedTx);
  console.debug('[CapacityExchange] Tx bytes length:', txBytes.length);

  const dustTx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
    'signature',
    'proof',
    'pre-binding',
    txBytes
  ).bind();
  console.debug('[CapacityExchange] DUST transaction deserialized successfully');
  console.debug('[CapacityExchange] DUST tx identifiers:', dustTx.identifiers());
  logTransactionImbalances('DUST tx from CES', dustTx);

  console.debug('[CapacityExchange] Step 2: Proving user transaction');
  const proveTxConfig = zkConfig ? { zkConfig } : undefined;
  console.debug('[CapacityExchange] Calling proofProvider.proveTx...');
  const provenTx = (await proofProvider.proveTx(tx, proveTxConfig)).bind();
  console.debug('[CapacityExchange] User transaction proven successfully');
  console.debug('[CapacityExchange] Proven tx identifiers:', provenTx.identifiers());
  logTransactionImbalances('Proven user tx', provenTx);

  console.debug('[CapacityExchange] Step 3: Merging transactions');
  const mergedTx = provenTx.merge(dustTx);
  console.debug('[CapacityExchange] Merged tx identifiers:', mergedTx.identifiers());
  logTransactionImbalances('Merged tx (before balanceSealedTransaction)', mergedTx);
  const serialized = mergedTx.serialize();
  const serializedStr = uint8ArrayToHex(serialized);
  console.debug('[CapacityExchange] Merged tx serialized, length:', serializedStr.length);

  console.debug('[CapacityExchange] Step 4: Calling wallet to balance and seal');
  const result = await connectedAPI.balanceSealedTransaction(serializedStr);
  console.debug('[CapacityExchange] Wallet balanced and sealed transaction');
  console.debug('[CapacityExchange] Result tx length:', result.tx.length);

  console.debug('[CapacityExchange] Step 5: Deserializing final transaction');
  const resultBytes = hexToUint8Array(result.tx);
  const transaction = Transaction.deserialize<SignatureEnabled, Proof, Binding>(
    'signature',
    'proof',
    'binding',
    resultBytes
  ).bind();

  console.debug('[CapacityExchange] Final tx identifiers:', transaction.identifiers());
  console.debug('[CapacityExchange] ========== Transaction Processing Complete ==========');
  return {
    transaction,
    type: 'NothingToProve' as const,
  };
}
