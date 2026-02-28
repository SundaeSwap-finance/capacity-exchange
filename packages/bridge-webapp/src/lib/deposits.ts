export interface Deposit {
  txHash: string;
  lovelace: bigint;
  coinPublicKey: string;
  submittedAt?: number;
  status: 'unconfirmed' | 'confirmed';
  index?: bigint;
}
