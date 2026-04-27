import { Proof, SignatureEnabled, Transaction, type Binding } from '@midnight-ntwrk/ledger-v8';

export function isOfferExpired(expiresAt: Date): boolean {
  return expiresAt < new Date();
}

export function serializeTx(tx: { serialize(): Uint8Array }): string {
  return Buffer.from(tx.serialize()).toString('hex');
}

export function deserializeTx(hex: Uint8Array): Transaction<SignatureEnabled, Proof, Binding> {
  return Transaction.deserialize<SignatureEnabled, Proof, Binding>('signature', 'proof', 'binding', hex);
}
