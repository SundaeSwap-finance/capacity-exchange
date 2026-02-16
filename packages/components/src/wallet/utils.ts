import { LedgerParameters } from '@midnight-ntwrk/ledger-v7';

export function isOfferExpired(expiresAt: Date): boolean {
  return expiresAt < new Date();
}

const query = `
    query BlockQuery {
      block {
        ledgerParameters
      }
    }
  `;

export const getLedgerParameters = async (graphQLEndpoint: string): Promise<LedgerParameters> => {
  const response = await fetch(graphQLEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
    }),
  });

  const result = await response.json();
  const bytes = Buffer.from(result.data.block.ledgerParameters, 'hex');
  return LedgerParameters.deserialize(bytes);
};
