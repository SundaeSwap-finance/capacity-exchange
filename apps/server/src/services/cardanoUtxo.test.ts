import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import { CardanoUtxoService, type BlockfrostTxUtxosResponse } from './cardanoUtxo.js';

const logger = pino({ level: 'debug' });

// Plug in a real tx hash here to test against an actual Blockfrost endpoint.
const TEST_TX_HASH = '61850034f25976b6046a72671fba20949edb5bc6cb6c61ffe64f229692dc10f5';
const TEST_OUTPUT_INDEX = 0;

function makeService() {
  const apiKey = process.env.BLOCKFROST_API_KEY ?? 'test-api-key';
  const baseUrl = process.env.BLOCKFROST_BASE_URL ?? 'http://cardano-preview.blockfrost.io/api/v0';
  return new CardanoUtxoService(apiKey, baseUrl, logger);
}

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
      text: async () => JSON.stringify(body),
    })),
  );
}

const MOCK_RESPONSE: BlockfrostTxUtxosResponse = {
  hash: TEST_TX_HASH,
  inputs: [],
  outputs: [
    {
      address: 'addr_test1',
      amount: [{ unit: 'lovelace', quantity: '5000000' }],
      tx_hash: TEST_TX_HASH,
      output_index: 0,
      data_hash: null,
      inline_datum: null,
      reference_script_hash: null,
      collateral: false,
    },
    {
      address: 'addr_test2',
      amount: [{ unit: 'lovelace', quantity: '2000000' }],
      tx_hash: TEST_TX_HASH,
      output_index: 1,
      data_hash: null,
      inline_datum: null,
      reference_script_hash: null,
      collateral: false,
    },
  ],
};

describe('CardanoUtxoService.verifyUtxoExists', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the full response when the output index is present', async () => {
    mockFetch(200, MOCK_RESPONSE);

    const result = await makeService().verifyUtxoExists({ txHash: TEST_TX_HASH, outputIndex: TEST_OUTPUT_INDEX });

    expect(result).toEqual(MOCK_RESPONSE);
  });

  // it('returns null when the output index is not in the transaction', async () => {
  //   mockFetch(200, MOCK_RESPONSE);

  //   const result = await makeService().verifyUtxoExists({ txHash: TEST_TX_HASH, outputIndex: 99 });

  //   expect(result).toBeNull();
  // });

  // it('returns null when Blockfrost returns 404', async () => {
  //   mockFetch(404, { error: 'Not Found' });

  //   const result = await makeService().verifyUtxoExists({ txHash: TEST_TX_HASH, outputIndex: TEST_OUTPUT_INDEX });

  //   expect(result).toBeNull();
  // });

  // it('throws on unexpected Blockfrost error status', async () => {
  //   mockFetch(500, { error: 'Internal Server Error' });

  //   await expect(
  //     makeService().verifyUtxoExists({ txHash: TEST_TX_HASH, outputIndex: TEST_OUTPUT_INDEX }),
  //   ).rejects.toThrow('Blockfrost request failed with status 500');
  // });

  // it('calls the correct Blockfrost URL with the provided tx hash', async () => {
  //   mockFetch(200, { ...MOCK_RESPONSE, outputs: [] });
  //   const txHash = 'b'.repeat(64);

  //   await makeService().verifyUtxoExists({ txHash, outputIndex: 0 });

  //   const [url, init] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
  //   expect(url).toContain(`/txs/${txHash}/utxos`);
  //   expect((init.headers as Record<string, string>).project_id).toBeDefined();
  // });
});
