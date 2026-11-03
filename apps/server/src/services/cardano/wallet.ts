import {
  Address,
  Credential,
  PartialBlockHeader,
  PaymentAddress,
  Slot,
  SubTransactionBody,
  Transaction,
  TransactionBody,
  TransactionId,
  TransactionInput,
  TransactionOutput,
  TransactionUnspentOutput,
  isRewardAccount,
} from '@capacity-exchange/cardano-core';
import { ChainIndex } from './utils';
import { CardanoChainStateService, ChainFollower } from './chain-state';

const txInKey = (txIn: TransactionInput): string => {
  return `${txIn.transactionId()}:${txIn.index()}`;
};

export class CardanoWalletService implements ChainFollower {
  #address: Address;
  #chainState: CardanoChainStateService;
  #tracker: WalletTracker;

  constructor(address: Address, chainState: CardanoChainStateService) {
    const paymentCredential = address.getProps().paymentPart;
    if (!paymentCredential) {
      throw new Error('Address must contain payment credential');
    }
    this.#address = address;
    this.#tracker = new WalletTracker(paymentCredential, Slot(0), []);
    this.#chainState = chainState;
    chainState.addFollower(this);
  }

  changeAddress(): PaymentAddress {
    const changeAddress = this.#address.toBech32();
    if (isRewardAccount(changeAddress)) {
      throw new Error('Cannot send change to a reward account');
    }
    return changeAddress;
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

  async signAndSubmitTx(tx: Transaction) {
    // TODO: attach our signature
    // TODO: flag any UTXOs spent by this transaction so we don't re-spend em
    await this.#chainState.submit(tx);
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
    for (const subTx of txBody.subTransactions()?.values() ?? []) {
      applyTx(subTx.getId(), subTx.body());
    }
    applyTx(tx.getId(), txBody);
  }

  protected copyValue(
    value: Map<string, TransactionUnspentOutput>,
  ): Map<string, TransactionUnspentOutput> {
    return new Map(value);
  }
}
