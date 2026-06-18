/** Common shape for verifying an on-chain payment to the server. */
export interface PaymentRef {
  txHash: string;
  /** Address that sent the payment. */
  senderAddress: string;
  /** Minimum value expected, in the chain's base unit (lovelace / wei). */
  sentValue: bigint;
}

/** Any chain's payment verification service. */
export interface ChainService<TRef extends PaymentRef, TResult> {
  verifyPayment(ref: TRef): Promise<TResult | null>;
}
