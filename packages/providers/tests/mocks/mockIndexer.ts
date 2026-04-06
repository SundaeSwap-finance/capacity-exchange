import { vi } from 'vitest';

export const mockLedgerParametersResponse = {
  data: {
    block: {
      // Mock ledger parameters as hex string
      ledgerParameters: '0a0b0c0d0e0f1011121314151617181920',
    },
  },
};

export function setupIndexerMock() {
  global.fetch = vi.fn().mockImplementation((url: string, options?: any) => {
    // Check if this is a GraphQL request to the indexer
    if (url.includes('graphql')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => mockLedgerParametersResponse,
      } as Response);
    }

    // Fallback
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
    } as Response);
  });
}

export function teardownIndexerMock() {
  vi.restoreAllMocks();
}
