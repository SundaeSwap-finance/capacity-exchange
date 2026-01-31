import { LedgerParameters } from '@midnight-ntwrk/ledger-v6';

export function isOfferExpired(expiresAt: Date): boolean {
  return expiresAt < new Date();
}

export function uint8ArrayToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export function hexToUint8Array(hex: string): Uint8Array {
  const cleaned = hex.replace(/^0x/, '');
  const matches = cleaned.match(/.{1,2}/g);
  if (!matches) {
    return new Uint8Array();
  }
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
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
