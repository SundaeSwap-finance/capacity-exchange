import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import { CardanoService } from './cardano.js';
import { BlockFrostAPI, BlockfrostServerError } from '@blockfrost/blockfrost-js';

type TxUtxos = Awaited<ReturnType<BlockFrostAPI['txsUtxos']>>;

const txsUtxosMock = vi.fn<BlockFrostAPI['txsUtxos']>();

vi.mock('@blockfrost/blockfrost-js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@blockfrost/blockfrost-js')>();
  return {
    ...actual,
     
    BlockFrostAPI: vi.fn().mockImplementation(function (this: any) {
      this.txsUtxos = txsUtxosMock;
    }),
  };
});

const logger = pino({ level: process.env.LOG_LEVEL ?? 'silent' });

const TEST_TX_HASH = 'ae8674c45b7763a549729f47c42477b16cf587b0f2ff9976d8026b047ff9ba87';
const SERVER_ADDRESS =
  'addr_test1qrp8nglm8d8x9w783c5g0qa4spzaft5z5xyx0kp495p8wksjrlfzuz6h4ssxlm78v0utlgrhryvl2gvtgp53a6j9zngqtjfk6s';
const SENDER_ADDRESS =
  'addr_test1xplan4jdxya4uf7az75smhz7xa6hf7xp2huj5v5vacmhgknlm8ty6vfmtcna69afphw9udm4wnuvz40e9gegem3hw3dqcrknql';

function makeService(serverAddress = SERVER_ADDRESS) {
  const apiKey = process.env.BLOCKFROST_API_KEY ?? 'api-test-key';
  const baseUrl = process.env.BLOCKFROST_BASE_URL ?? 'https://cardano-preview.blockfrost.io/api/v0';
  return new CardanoService(apiKey, baseUrl, logger, serverAddress);
}

function mockTxsUtxos(data: TxUtxos) {
  txsUtxosMock.mockResolvedValue(data);
}

function mockTxsUtxosError(status_code: number) {
  txsUtxosMock.mockRejectedValue(
    new BlockfrostServerError({ status_code, message: 'Error', error: 'Error', url: '' }),
  );
}

// Sender input: 6_000_000
// Server output: 5_000_000, change output: 700_000
// fee = 6_000_000 - (5_000_000 + 700_000) = 300_000
// effective = received + fee = 5_000_000 + 300_000 = 5_300_000
const MOCK_RESPONSE: TxUtxos = {
  hash: TEST_TX_HASH,
  inputs: [
    {
      address: 'addr_sender1',
      amount: [{ unit: 'lovelace', quantity: '6000000' }],
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
      output_index: 0,
      data_hash: null,
      inline_datum: null,
      reference_script_hash: null,
      collateral: false,
    },
    {
      address: 'addr_sender1',
      amount: [{ unit: 'lovelace', quantity: '700000' }],
      output_index: 1,
      data_hash: null,
      inline_datum: null,
      reference_script_hash: null,
      collateral: false,
    },
  ],
};

describe('CardanoService.verifyUtxoExists', () => {
  beforeEach(() => {
    txsUtxosMock.mockReset();
  });

  it.skipIf(!process.env.BLOCKFROST_API_KEY || process.env.BLOCKFROST_API_KEY === 'api-test-key')(
    'returns the full response when all checks pass (real Blockfrost fetch)',
    async () => {
      const result = await makeService().verifyUtxoExists({
        txHash: TEST_TX_HASH,
        senderAddress: SENDER_ADDRESS,
        sentValue: 15_000_000n,
      });

      expect(result).not.toBeNull();
      expect(result!.hash).toBe(TEST_TX_HASH);
      expect(result!.outputs.some((o) => o.address === SERVER_ADDRESS)).toBe(true);
    },
  );

  it('returns null when the transaction is not found (404)', async () => {
    mockTxsUtxosError(404);
    const result = await makeService().verifyUtxoExists({
      txHash: 'a'.repeat(64),
      senderAddress: 'addr_sender1',
      sentValue: 1n,
    });
    expect(result).toBeNull();
  });

  it('throws when Blockfrost returns an unexpected error status', async () => {
    mockTxsUtxosError(500);
    await expect(
      makeService().verifyUtxoExists({
        txHash: TEST_TX_HASH,
        senderAddress: 'addr_sender1',
        sentValue: 1n,
      }),
    ).rejects.toThrow('Blockfrost request failed with status 500');
  });

  it('returns null when no output is addressed to the server', async () => {
    mockTxsUtxos(MOCK_RESPONSE);
    const result = await makeService('addr_unknown_server').verifyUtxoExists({
      txHash: TEST_TX_HASH,
      senderAddress: 'addr_sender1',
      sentValue: 1n,
    });
    expect(result).toBeNull();
  });

  it('returns null when no input originates from the sender address', async () => {
    mockTxsUtxos(MOCK_RESPONSE);
    const result = await makeService('addr_server1').verifyUtxoExists({
      txHash: TEST_TX_HASH,
      senderAddress: 'addr_unknown_sender',
      sentValue: 1n,
    });
    expect(result).toBeNull();
  });

  it('returns null when received + fee is below sentValue', async () => {
    mockTxsUtxos(MOCK_RESPONSE);
    // effective = 5_000_000 + 300_000 = 5_300_000 < 6_000_000
    const result = await makeService('addr_server1').verifyUtxoExists({
      txHash: TEST_TX_HASH,
      senderAddress: 'addr_sender1',
      sentValue: 6_000_000n,
    });
    expect(result).toBeNull();
  });

  it('returns the full response when received + fee meets sentValue', async () => {
    mockTxsUtxos(MOCK_RESPONSE);
    // effective = 5_000_000 + 300_000 = 5_300_000 >= 5_300_000
    const result = await makeService('addr_server1').verifyUtxoExists({
      txHash: TEST_TX_HASH,
      senderAddress: 'addr_sender1',
      sentValue: 5_300_000n,
    });
    expect(result).not.toBeNull();
    expect(result!.hash).toBe(TEST_TX_HASH);
  });
});
