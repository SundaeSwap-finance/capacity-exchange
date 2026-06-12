import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import { CardanoUtxoService, type BlockfrostTxUtxosResponse } from './cardanoUtxo.js';

const logger = pino({ level: 'silent' });

const TEST_TX_HASH = 'ae8674c45b7763a549729f47c42477b16cf587b0f2ff9976d8026b047ff9ba87';
const SERVER_ADDRESS =
  'addr_test1qrp8nglm8d8x9w783c5g0qa4spzaft5z5xyx0kp495p8wksjrlfzuz6h4ssxlm78v0utlgrhryvl2gvtgp53a6j9zngqtjfk6s';
const SENDER_ADDRESS =
  'addr_test1xplan4jdxya4uf7az75smhz7xa6hf7xp2huj5v5vacmhgknlm8ty6vfmtcna69afphw9udm4wnuvz40e9gegem3hw3dqcrknql';

function makeService(serverAddress = SERVER_ADDRESS) {
  const apiKey = process.env.BLOCKFROST_API_KEY ?? 'api-test-key';
  const baseUrl = process.env.BLOCKFROST_BASE_URL ?? 'https://cardano-preview.blockfrost.io/api/v0';
  return new CardanoUtxoService(apiKey, baseUrl, logger, serverAddress);
}

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      status,
      ok: status >= 200 && status < 300,
      json: async () => body,
    })),
  );
}

const MOCK_RESPONSE: BlockfrostTxUtxosResponse = {
  hash: TEST_TX_HASH,
  inputs: [
    {
      address: 'addr_sender1',
      amount: [{ unit: 'lovelace', quantity: '1000000' }],
      tx_hash: TEST_TX_HASH,
      output_index: 0,
      data_hash: null,
      inline_datum: null,
      reference_script_hash: null,
      collateral: false,
      reference: false,
    },
  ],
  outputs: [
    {
      address: 'addr_server1',
      amount: [{ unit: 'lovelace', quantity: '5000000' }],
      tx_hash: TEST_TX_HASH,
      output_index: 0,
      data_hash: null,
      inline_datum: null,
      reference_script_hash: null,
      collateral: false,
    },
    {
      address: 'addr_change1',
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

  it('returns the full response when server address, sender address, and sent value all match', async () => {
    const result = await makeService().verifyUtxoExists({
      txHash: TEST_TX_HASH,
      senderAddress: SENDER_ADDRESS,
      sentValue: 15_000_000n,
    });

    expect(result).not.toBeNull();
    expect(result!.hash).toBe(TEST_TX_HASH);
    expect(result!.outputs.some((o) => o.address === SERVER_ADDRESS)).toBe(true);
  });

  it('passes when server address, sender address, and minimum ADA are all satisfied', async () => {
    const result = await makeService(SERVER_ADDRESS).verifyUtxoExists({
      txHash: TEST_TX_HASH,
      senderAddress: SENDER_ADDRESS,
      sentValue: 15_000_000n,
    });

    expect(result).not.toBeNull();
    expect(result!.hash).toBe(TEST_TX_HASH);
  });
});
