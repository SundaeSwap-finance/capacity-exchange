/**
 * Ethereum payment verification service.
 *
 * Mirrors CardanoService; verifies a transaction
 * was sent to the server address with the expected value, polling until
 * confirmed or the max wait time is exceeded.
 *
 * Uses ethers.js JsonRpcProvider.
 */

import { JsonRpcProvider, type TransactionResponse } from 'ethers';
import { FastifyBaseLogger } from 'fastify';
import { ChainService, PaymentRef } from './paymentRef.js';

// sentValue is in wei; gas fees are paid separately and do not reduce the received value
export type EthTxRef = PaymentRef;

export class EthereumService implements ChainService<EthTxRef, TransactionResponse> {
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
  async verifyPayment(
    ref: EthTxRef,
    { pollIntervalMs = 10_000, maxWaitMs = 3 * 60_000 } = {},
  ): Promise<TransactionResponse | null> {
    this.logger.debug({ txHash: ref.txHash }, 'Verifying Ethereum TX via JSON-RPC');

    const deadline = Date.now() + maxWaitMs;

    let tx: TransactionResponse | null;
    while (true) {
      try {
        tx = await this.provider.getTransaction(ref.txHash);
        this.logger.debug({ tx }, 'getTransaction result');
      } catch (err) {
        throw new Error(`JSON-RPC request failed: ${err instanceof Error ? err.message : err}`);
      }

      if (!tx) {
        this.logger.warn({ txHash: ref.txHash }, 'Transaction not found');
        return null;
      }

      this.logger.debug({ to: tx.to, from: tx.from, value: tx.value.toString() }, 'TX found');

      if (tx.blockNumber !== null) {
        break;
      }

      if (Date.now() + pollIntervalMs > deadline) {
        this.logger.warn({ txHash: ref.txHash }, 'Transaction still pending after max wait');
        return null;
      }

      this.logger.info({ txHash: ref.txHash, pollIntervalMs }, 'Transaction pending, retrying');
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    if (tx.data !== '0x') {
      this.logger.warn(
        { txHash: ref.txHash, data: tx.data },
        'Transaction is not a plain ETH transfer',
      );
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
        'Transaction value below expected',
      );
      return null;
    }

    return tx;
  }
}
