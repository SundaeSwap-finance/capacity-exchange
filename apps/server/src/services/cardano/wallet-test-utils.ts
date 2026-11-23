import { vi } from 'vitest';
import { Cardano } from '@cardano-sdk/core';
import {
  Address,
  BlockId,
  BlockNo,
  CborReader,
  CborWriter,
  PartialBlockHeader,
  Slot,
  Transaction,
} from '@capacity-exchange/cardano-core';
import { CardanoWalletService } from './wallet.js';
import { seedToSigningKey } from '../../config/cardanoKeys.js';
import type { CardanoChainStateService, SubmitTxResult } from './chain-state.js';

const hash28 = (byte: number) => byte.toString(16).padStart(2, '0').repeat(28);
const hash32 = (byte: number) => byte.toString(16).padStart(2, '0').repeat(32);

export const keyCredential = (byte: number): Cardano.Credential => ({
  type: Cardano.CredentialType.KeyHash,
  hash: hash28(byte) as Cardano.Credential['hash'],
});
export const scriptCredential = (byte: number): Cardano.Credential => ({
  type: Cardano.CredentialType.ScriptHash,
  hash: hash28(byte) as Cardano.Credential['hash'],
});

export const baseAddress = (payment: Cardano.Credential, stake: Cardano.Credential) =>
  Cardano.BaseAddress.fromCredentials(Cardano.NetworkId.Testnet, payment, stake)
    .toAddress()
    .toBech32();
export const enterpriseAddress = (payment: Cardano.Credential) =>
  Cardano.EnterpriseAddress.fromCredentials(Cardano.NetworkId.Testnet, payment)
    .toAddress()
    .toBech32();

export const OURS = keyCredential(1);
export const WALLET_ADDRESS = baseAddress(OURS, keyCredential(2));
export const SOMEONE_ELSE = baseAddress(keyCredential(3), keyCredential(2));

export const header = (slot: number): PartialBlockHeader => ({
  blockNo: BlockNo(slot),
  slot: Slot(slot),
  hash: BlockId(slot.toString(16).padStart(64, '0')),
});

/** An input spending an output of a transaction outside the test. */
export const externalInput = (byte: number, index = 0): Cardano.TxIn => ({
  txId: Cardano.TransactionId(hash32(byte)),
  index,
});

export const output = (address: string, coins = 2_000_000n): Cardano.TxOut => ({
  address: Cardano.PaymentAddress(address),
  value: { coins },
});

export interface TxSpec {
  inputs: Cardano.TxIn[];
  outputs: Cardano.TxOut[];
  collaterals?: Cardano.TxIn[];
  collateralReturn?: Cardano.TxOut;
  isValid?: boolean;
  ttl?: number;
}

// The id passed to fromCore is ignored by getId(), which hashes the body.
const PLACEHOLDER_ID = Cardano.TransactionId(hash32(0));

export function tx(
  { inputs, outputs, collaterals, collateralReturn, isValid, ttl }: TxSpec,
  subTransactions: TxSpec[] = [],
): Transaction {
  return Transaction.fromCore({
    id: PLACEHOLDER_ID,
    isValid,
    body: {
      inputs,
      outputs,
      collaterals,
      collateralReturn,
      fee: 200_000n,
      validityInterval: ttl === undefined ? undefined : { invalidHereafter: Slot(ttl) },
      subTransactions: subTransactions.length
        ? subTransactions.map((sub) => ({
            body: { inputs: sub.inputs, outputs: sub.outputs },
            witness: { signatures: new Map() },
          }))
        : undefined,
    },
    witness: { signatures: new Map() },
  });
}

/** The input that spends output `index` of `tx`. */
export const spend = (tx: { getId(): Cardano.TransactionId }, index = 0): Cardano.TxIn => ({
  txId: tx.getId(),
  index,
});

export const subTx = (parent: Transaction, i: number) =>
  [...parent.body().subTransactions()!.values()][i];

/** The wallet's UTxOs as `txId#index` refs, sorted. */
export function refs(wallet: CardanoWalletService): string[] {
  return wallet
    .utxos()
    .map((utxo) => `${utxo.input().transactionId()}#${utxo.input().index()}`)
    .sort();
}
export const ref = (tx: { getId(): Cardano.TransactionId }, index = 0) => `${tx.getId()}#${index}`;
export const walletKeyPair = seedToSigningKey(new Uint8Array(32).fill(7));

export const newWallet = (
  submit: (tx: Transaction) => Promise<SubmitTxResult> = async () => ({
    status: 'ok',
    reachedMempool: true,
  }),
) => {
  const wallet = new CardanoWalletService(Address.fromBech32(WALLET_ADDRESS), walletKeyPair, {
    addFollower() {
      // do nothing. it's simpler to manually call the roll forward/back methods.
    },
    submit: vi.fn(submit),
  } as unknown as CardanoChainStateService);
  wallet.initState(Slot(0));
  return wallet;
};

/** A wallet holding one confirmed UTxO per entry in `coins`, funded in slot 10. */
export async function fundedWallet(
  submit?: (tx: Transaction) => Promise<SubmitTxResult>,
  coins: bigint[] = [10_000_000n],
) {
  const wallet = newWallet(submit);
  const funding = tx({
    inputs: [externalInput(10)],
    outputs: coins.map((c) => output(WALLET_ADDRESS, c)),
  });
  await wallet.onRollForward(header(10), [funding]);
  return { wallet, funding };
}

/** A transaction spending `inputs`, paying someone else and returning change to the wallet. */
export const payment = (inputs: Cardano.TxIn[], ttl: number) =>
  tx({ inputs, outputs: [output(SOMEONE_ELSE), output(WALLET_ADDRESS)], ttl });

/** Saves `wallet`'s state and loads it into a fresh wallet. */
export const reload = (
  wallet: CardanoWalletService,
  submit?: (tx: Transaction) => Promise<SubmitTxResult>,
) => {
  const writer = new CborWriter();
  wallet.saveState(writer);
  const loaded = newWallet(submit);
  loaded.loadState(new CborReader(writer.encodeAsHex()));
  return loaded;
};
