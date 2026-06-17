import { describe, it, expect, vi, beforeEach } from 'vitest';
import pino from 'pino';
import { EthereumService, WEI_PER_ETH } from './ethereum.js';
import { JsonRpcProvider, type TransactionResponse } from 'ethers';

const getTransactionMock = vi.fn<JsonRpcProvider['getTransaction']>();

vi.mock('ethers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ethers')>();
  return {
    ...actual,
    JsonRpcProvider: vi.fn().mockImplementation(function (this: any) {
      this.getTransaction = getTransactionMock;
    }),
  };
});

const logger = pino({ level: process.env.LOG_LEVEL ?? 'silent' });

const TEST_TX_HASH = '0x' + 'ab'.repeat(32);
const SERVER_ADDRESS = '0x' + '11'.repeat(20);
const SENDER_ADDRESS = '0x' + '22'.repeat(20);

function makeService(serverAddress = SERVER_ADDRESS) {
  return new EthereumService('https://ethereum-sepolia-rpc.publicnode.com', logger, serverAddress);
}

function makeTx(overrides: Partial<TransactionResponse> = {}): TransactionResponse {
  return {
    hash: TEST_TX_HASH,
    blockNumber: 12345678,
    to: SERVER_ADDRESS,
    from: SENDER_ADDRESS,
    value: WEI_PER_ETH,   // 1 ETH
    ...overrides,
  } as unknown as TransactionResponse;
}

function mockGetTransaction(tx: TransactionResponse | null) {
  getTransactionMock.mockResolvedValue(tx);
}

function mockGetTransactionError(message: string) {
  getTransactionMock.mockRejectedValue(new Error(message));
}

describe('EthereumService.verifyTxExists', () => {
  beforeEach(() => {
    getTransactionMock.mockReset();
  });

  it('returns the full response when all checks pass', async () => {
    mockGetTransaction(makeTx());
    const result = await makeService().verifyTxExists({
      txHash: TEST_TX_HASH,
      senderAddress: SENDER_ADDRESS,
      sentValue: WEI_PER_ETH,
    });
    expect(result).not.toBeNull();
    expect(result!.hash).toBe(TEST_TX_HASH);
  });

  it('returns null when the transaction does not exist', async () => {
    mockGetTransaction(null);
    const result = await makeService().verifyTxExists({
      txHash: TEST_TX_HASH,
      senderAddress: SENDER_ADDRESS,
      sentValue: WEI_PER_ETH,
    });
    expect(result).toBeNull();
  });

  it('throws when the RPC call fails', async () => {
    mockGetTransactionError('connection refused');
    await expect(
      makeService().verifyTxExists({
        txHash: TEST_TX_HASH,
        senderAddress: SENDER_ADDRESS,
        sentValue: 1n,
      }),
    ).rejects.toThrow('JSON-RPC request failed: connection refused');
  });

  it('returns null when the transaction is still pending (no blockNumber)', async () => {
    mockGetTransaction(makeTx({ blockNumber: null }));
    const result = await makeService().verifyTxExists({
      txHash: TEST_TX_HASH,
      senderAddress: SENDER_ADDRESS,
      sentValue: WEI_PER_ETH,
    });
    expect(result).toBeNull();
  });

  it('returns null when the recipient is not the server address', async () => {
    mockGetTransaction(makeTx({ to: '0x000000000000000000000000000000000000dEaD' }));
    const result = await makeService().verifyTxExists({
      txHash: TEST_TX_HASH,
      senderAddress: SENDER_ADDRESS,
      sentValue: 1n,
    });
    expect(result).toBeNull();
  });

  it('returns null when the sender does not match', async () => {
    mockGetTransaction(makeTx());
    const result = await makeService().verifyTxExists({
      txHash: TEST_TX_HASH,
      senderAddress: '0x0000000000000000000000000000000000000000',
      sentValue: 1n,
    });
    expect(result).toBeNull();
  });

  it('returns null when value is below sentValue', async () => {
    mockGetTransaction(makeTx({ value: WEI_PER_ETH / 2n }));  // 0.5 ETH
    const result = await makeService().verifyTxExists({
      txHash: TEST_TX_HASH,
      senderAddress: SENDER_ADDRESS,
      sentValue: WEI_PER_ETH,  // expected 1 ETH
    });
    expect(result).toBeNull();
  });

  it('returns the full response when value exactly meets sentValue', async () => {
    mockGetTransaction(makeTx({ value: WEI_PER_ETH }));
    const result = await makeService().verifyTxExists({
      txHash: TEST_TX_HASH,
      senderAddress: SENDER_ADDRESS,
      sentValue: WEI_PER_ETH,
    });
    expect(result).not.toBeNull();
    expect(result!.hash).toBe(TEST_TX_HASH);
  });

  it('address comparison is case-insensitive', async () => {
    mockGetTransaction(makeTx({ to: SERVER_ADDRESS.toLowerCase(), from: SENDER_ADDRESS.toLowerCase() }));
    const result = await makeService(SERVER_ADDRESS.toUpperCase()).verifyTxExists({
      txHash: TEST_TX_HASH,
      senderAddress: SENDER_ADDRESS.toUpperCase(),
      sentValue: 1n,
    });
    expect(result).not.toBeNull();
  });
});
