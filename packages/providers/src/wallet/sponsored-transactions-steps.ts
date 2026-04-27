import { type FinalizedTransaction } from '@midnight-ntwrk/ledger-v8';
import type { UnboundTransaction } from '@midnight-ntwrk/midnight-js-types';
import { hexToBytes } from '@sundaeswap/capacity-exchange-core';
import { serializeTx, deserializeTx } from './utils';
import type { CesApi } from './exchangeApi';

/**
 * Sends a proven (unbound) transaction to the CES for sponsorship.
 * The server validates eligibility, builds a dust tx, merges, binds, and returns the finalized transaction.
 */
export async function requestSponsorship(tx: UnboundTransaction, exchangeApi: CesApi): Promise<FinalizedTransaction> {
  const serializedTx = serializeTx(tx);
  console.debug('[SponsoredTransactions] Requesting sponsorship from CES:', exchangeApi.url);

  const response = await exchangeApi.api.apiSponsorPost({
    apiSponsorPostRequest: { provenTx: serializedTx },
  });

  console.debug('[SponsoredTransactions] Sponsorship response received');
  return deserializeTx(hexToBytes(response.tx));
}
