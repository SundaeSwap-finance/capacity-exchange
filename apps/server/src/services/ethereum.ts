/**
 * POC: Ethereum balance / TX verification service.
 *
 * Mirrors CardanoService (services/cardano.ts) but for Ethereum.
 * Uses ethers.js JsonRpcProvider instead of Blockfrost.
 *
 * Install: bun add ethers  (in apps/server)
 */

import { JsonRpcProvider, type TransactionResponse } from 'ethers';
import { FastifyBaseLogger } from 'fastify';

/** 1 ETH in wei — Ethereum's equivalent of 1 ADA in lovelace. */
export const WEI_PER_ETH = 1_000_000_000_000_000_000n;

export interface EthTxRef {
  txHash: string;
  /** ETH address that sent the payment (0x…). */
  senderAddress: string;
  /** Minimum ETH value expected, in wei. */
  sentValue: bigint;
}

export class EthereumService {
  private readonly provider: JsonRpcProvider;

  constructor(
    rpcUrl: string,
    private readonly logger: FastifyBaseLogger,
    /** Server's ETH address that should receive the payment (0x…). */
    private readonly serverAddress: string,
  ) {
    this.provider = new JsonRpcProvider(rpcUrl);
  }

  /**
   * Verifies that a transaction:
   *   1. Exists and is confirmed on-chain
   *   2. Was sent TO the server's address
   *   3. Originated FROM the expected sender
   *   4. Carried at least `sentValue` wei
   *
   * Returns the full TransactionResponse on success, null on any mismatch.
   *
   * Note: unlike Cardano/lovelace, Ethereum gas fees are paid separately by
   * the sender and do NOT reduce the received value — no fee adjustment needed.
   */
  async verifyTxExists(ref: EthTxRef): Promise<TransactionResponse | null> {
    this.logger.debug({ txHash: ref.txHash }, 'Verifying Ethereum TX via JSON-RPC');

    let tx: TransactionResponse | null;
    try {
      tx = await this.provider.getTransaction(ref.txHash);
    } catch (err) {
      throw new Error(`JSON-RPC request failed: ${err instanceof Error ? err.message : err}`);
    }

    if (!tx) {
      this.logger.warn({ txHash: ref.txHash }, 'Transaction not found');
      return null;
    }

    this.logger.debug({ to: tx.to, from: tx.from, value: tx.value.toString() }, 'TX found');

    // Must be mined (blockNumber is null for pending TXs)
    if (tx.blockNumber === null) {
      this.logger.warn({ txHash: ref.txHash }, 'Transaction is still pending');
      return null;
    }

    if (tx.to?.toLowerCase() !== this.serverAddress.toLowerCase()) {
      this.logger.warn(
        { to: tx.to, serverAddress: this.serverAddress },
        'Transaction recipient does not match server address',
      );
      return null;
    }

    if (tx.from.toLowerCase() !== ref.senderAddress.toLowerCase()) {
      this.logger.warn(
        { from: tx.from, senderAddress: ref.senderAddress },
        'Transaction sender does not match expected address',
      );
      return null;
    }

    const received = tx.value;
    if (received < ref.sentValue) {
      this.logger.warn(
        { sentValue: ref.sentValue.toString(), received: received.toString() },
        'Transaction value below expected minimum',
      );
      return null;
    }

    return tx;
  }
}