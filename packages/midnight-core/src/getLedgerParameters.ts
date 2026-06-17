import { LedgerParameters } from '@midnight-ntwrk/ledger-v8';
import { indexerQuery } from './indexer.js';

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
  const data = await indexerQuery<{ block?: { ledgerParameters?: string } }>(
    graphQLEndpoint,
    query,
    'block.ledgerParameters',
    options.signal
  );
  const hex = data.block?.ledgerParameters;
  if (typeof hex !== 'string') {
    throw new Error(`Indexer returned no block.ledgerParameters (got: ${JSON.stringify(data)})`);
  }
  return LedgerParameters.deserialize(Buffer.from(hex, 'hex'));
};
