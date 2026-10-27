import {
  Address,
  Credential,
  PartialBlockHeader,
  Slot,
  SubTransactionBody,
  Transaction,
  TransactionBody,
  TransactionId,
  TransactionInput,
  TransactionOutput,
  TransactionUnspentOutput,
} from '@capacity-exchange/cardano-core';
import { ChainIndex } from './utils';
import { ChainFollower } from './chain-state';

const txInKey = (txIn: TransactionInput): string => {
  return `${txIn.transactionId()}:${txIn.index()}`;
};

export class CardanoWalletService implements ChainFollower {
  #tracker: WalletTracker;

  constructor(address: Address) {
    const paymentCredential = address.getProps().paymentPart;
    if (!paymentCredential) {
      throw new Error('Address must contain payment credential');
    }
    this.#tracker = new WalletTracker(paymentCredential, Slot(0), []);
  }

  utxos(): TransactionUnspentOutput[] {
    return [...this.#tracker.currentValue().values()];
  }

  /** The ADA held across the wallet's UTxOs, in lovelace. */
  lovelace(): bigint {
    let total = 0n;
    for (const utxo of this.#tracker.currentValue().values()) {
      total += utxo.output().amount().coin();
    }
    return total;
  }

  async onRollForward(header: PartialBlockHeader, txs: Transaction[]) {
    for (const tx of txs) {
      this.#tracker.applyTransaction(header.slot, tx);
    }
  }

  async onRollBackward(header: PartialBlockHeader) {
    this.#tracker.rollBack(header.slot);
  }
}

class WalletTracker extends ChainIndex<Map<string, TransactionUnspentOutput>> {
  #paymentCredential: Credential;
  constructor(
    paymentCredential: Credential,
    startSlot: Slot,
    startUtxos: TransactionUnspentOutput[],
  ) {
    super(startSlot, new Map(startUtxos.map((utxo) => [txInKey(utxo.input()), utxo] as const)));
    this.#paymentCredential = paymentCredential;
  }

  protected doApplyTransaction(tx: Transaction, value: Map<string, TransactionUnspentOutput>) {
    const markSpent = (input: TransactionInput) => {
      const key = `${input.transactionId()}:${input.index()}`;
      value.delete(key);
    };
    const markCreated = (output: TransactionOutput, txId: TransactionId, index: bigint) => {
      const payTo = output.address().getProps().paymentPart;
      if (
        !payTo ||
        payTo.type !== this.#paymentCredential.type ||
        payTo.hash !== this.#paymentCredential.hash
      ) {
        return;
      }
      const input = new TransactionInput(txId, index);
      value.set(txInKey(input), new TransactionUnspentOutput(input, output));
    };

    const applyTx = (txId: TransactionId, txBody: TransactionBody | SubTransactionBody) => {
      for (const input of txBody.inputs().values()) {
        markSpent(input);
      }
      let index = 0n;
      for (const output of txBody.outputs()) {
        markCreated(output, txId, index);
        index++;
      }
    };

    const txBody = tx.body();
    if (!tx.isValid()) {
      // A transaction that failed phase-2 validation, sub-transactions and all,
      // only spends its collateral and creates its collateral return, which
      // follows the regular outputs.
      for (const input of txBody.collateral()?.values() ?? []) {
        markSpent(input);
      }
      const collateralReturn = txBody.collateralReturn();
      if (collateralReturn) {
        markCreated(collateralReturn, tx.getId(), BigInt(txBody.outputs().length));
      }
      return;
    }
    applyTx(tx.getId(), txBody);
    for (const subTx of txBody.subTransactions()?.values() ?? []) {
      applyTx(subTx.getId(), subTx.body());
    }
  }

  protected copyValue(
    value: Map<string, TransactionUnspentOutput>,
  ): Map<string, TransactionUnspentOutput> {
    return new Map(value);
  }
}
