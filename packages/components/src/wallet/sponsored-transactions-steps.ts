import {
  Transaction,
  type SignatureEnabled,
  type Proof,
  type Binding,
  type FinalizedTransaction,
} from '@midnight-ntwrk/ledger-v7';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { hexToBytes } from '@capacity-exchange/midnight-core';
import type { CesApi } from './exchangeApi';

/**
 * Sends a proven (unbound) transaction to the CES for sponsorship.
 * The server validates eligibility, builds a dust tx, merges, binds, and returns the finalized transaction.
 */
export async function requestSponsorship(tx: UnboundTransaction, exchangeApi: CesApi): Promise<FinalizedTransaction> {
  const serializedTx = Buffer.from(tx.serialize()).toString('hex');
  console.debug('[SponsoredTransactions] Requesting sponsorship from CES:', exchangeApi.url);

  const response = await exchangeApi.api.apiSponsorPost({
    apiSponsorPostRequest: { provenTx: serializedTx },
  });

  console.debug('[SponsoredTransactions] Sponsorship response received');
  const resultBytes = hexToBytes(response.tx);

  return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', resultBytes);
}
