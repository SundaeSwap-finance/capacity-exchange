import { LedgerParameters } from '@midnight-ntwrk/ledger-v8';

const query = `
    query BlockQuery {
      block {
        ledgerParameters
      }
    }
  `;

export interface GetLedgerParametersOptions {
  signal?: AbortSignal;
}

export const getLedgerParameters = async (
  graphQLEndpoint: string,
  options: GetLedgerParametersOptions = {}
): Promise<LedgerParameters> => {
  const response = await fetch(graphQLEndpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
    }),
    signal: options.signal,
  });

  const result = await response.json();
  const bytes = Buffer.from(result.data.block.ledgerParameters, 'hex');
  return LedgerParameters.deserialize(bytes);
};
