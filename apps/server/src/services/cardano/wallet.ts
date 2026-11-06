import {
  Address,
  CborSet,
  Credential,
  Ed25519PublicKeyHex,
  Ed25519SignatureHex,
  HexBlob,
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
  VKeyWitness,
  isRewardAccount,
} from '@capacity-exchange/cardano-core';
import { ChainIndex } from './utils';
import { CardanoChainStateService, ChainFollower } from './chain-state';
import { Ed25519KeyPair } from '../../config/cardanoKeys';
import { sign } from 'node:crypto';

interface OwnedOutput {
  input: TransactionInput;
  output: TransactionOutput;
  validBefore: Slot | null;
  dependsOn: string[];
}
type UtxoSet = Map<string, OwnedOutput>;

const txInKey = (txIn: TransactionInput): string => {
  return `${txIn.transactionId()}:${txIn.index()}`;
};

const markSpent = (value: UtxoSet, input: TransactionInput) => {
  value.delete(txInKey(input));
};

interface PendingOutputDetails {
  validBefore: Slot;
  dependsOn: string[];
}

const markCreated = (
  value: UtxoSet,
  paymentCredential: Credential,
  output: TransactionOutput,
  txId: TransactionId,
  index: bigint,
  details: PendingOutputDetails | null,
) => {
  const payTo = output.address().getProps().paymentPart;
  if (!payTo || payTo.type !== paymentCredential.type || payTo.hash !== paymentCredential.hash) {
    return;
  }
  const input = new TransactionInput(txId, index);
  value.set(txInKey(input), {
    input,
    output,
    ...(details || { validBefore: null, dependsOn: [] }),
  });
};

const markOutputsCreated = (
  value: UtxoSet,
  paymentCredential: Credential,
  txBody: TransactionBody | SubTransactionBody,
  txId: TransactionId,
  details: PendingOutputDetails | null,
) => {
  let index = 0n;
  for (const output of txBody.outputs()) {
    markCreated(value, paymentCredential, output, txId, index, details);
    index += 1n;
  }
};

export class CardanoWalletService implements ChainFollower {
  #address: Address;
  #paymentCredential: Credential;
  #keys: Ed25519KeyPair;
  #chainState: CardanoChainStateService;
  #tracker: WalletTracker;
  #reserved: Map<string, Slot>;
  #pending: Map<string, OwnedOutput>;
  #slot: Slot;

  constructor(address: Address, keys: Ed25519KeyPair, chainState: CardanoChainStateService) {
    const paymentCredential = address.getProps().paymentPart;
    if (!paymentCredential) {
      throw new Error('Address must contain payment credential');
    }
    this.#address = address;
    this.#paymentCredential = paymentCredential;
    this.#keys = keys;
    this.#tracker = new WalletTracker(paymentCredential, Slot(0), []);
    this.#reserved = new Map();
    this.#pending = new Map();
    this.#slot = Slot(0);
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
    const slot = this.#slot;
    const live = new Map(this.#tracker.currentValue());
    for (const [k, v] of this.#pending) {
      if (
        (v.validBefore === null || v.validBefore > slot) &&
        v.dependsOn.every((i) => live.has(i))
      ) {
        live.set(k, v);
      }
    }
    return [...live]
      .filter(([k, _]) => !this.#reserved.has(k))
      .map(([_, v]) => new TransactionUnspentOutput(v.input, v.output));
  }

  /** The ADA held across the wallet's UTxOs, in lovelace. */
  lovelace(): bigint {
    let total = 0n;
    for (const utxo of this.utxos()) {
      total += utxo.output().amount().coin();
    }
    return total;
  }

  async onRollForward(header: PartialBlockHeader, txs: Transaction[]) {
    this.#slot = header.slot;
    const landed = new Set<string>();
    for (const tx of txs) {
      this.#tracker.applyTransaction(header.slot, tx);
      landed.add(tx.getId());
      for (const subTx of tx.body().subTransactions()?.values() ?? []) {
        landed.add(subTx.getId());
      }
    }
    // these entries appeared on chain or expired, they're not pending any more.
    // Match on the landed tx ids too: an output created and spent within the
    // same block never shows up in the tracker.
    for (const [key, value] of this.#pending) {
      if (
        (value.validBefore !== null && value.validBefore <= this.#slot) ||
        landed.has(value.input.transactionId()) ||
        this.#tracker.currentValue().has(key)
      ) {
        this.#pending.delete(key);
      }
    }
    // these entries aren't reserved anymore
    for (const [key, value] of this.#reserved) {
      if (value <= this.#slot) {
        this.#reserved.delete(key);
      }
    }
  }

  async onRollBackward(header: PartialBlockHeader) {
    this.#slot = header.slot;
    this.#tracker.rollBack(header.slot);
  }

  async signAndSubmitTx(tx: Transaction) {
    const id = Buffer.from(tx.getId(), 'hex');
    const vkey = Ed25519PublicKeyHex(HexBlob.fromBytes(this.#keys.publicKey));
    const signature = Ed25519SignatureHex(HexBlob.fromBytes(sign(null, id, this.#keys.privateKey)));

    const witnessSet = tx.witnessSet();
    const values = [...(witnessSet.vkeys()?.values() ?? [])];
    values.push(VKeyWitness.fromCore([vkey, signature]));
    const newVkeys = CborSet.fromCore([], VKeyWitness.fromCore);
    newVkeys.setValues(values);
    witnessSet.setVkeys(newVkeys);
    tx.setWitnessSet(witnessSet);

    const txBody = tx.body();
    const until = txBody.ttl() ?? Slot(this.#slot + 20);

    for (const input of txBody.inputs().values()) {
      this.#reserved.set(txInKey(input), until);
    }
    const result = await this.#chainState.submit(tx);
    if (result.status === 'ok') {
      const details = {
        validBefore: until,
        dependsOn: txBody
          .inputs()
          .values()
          .map((i) => txInKey(i))
          .filter((k) => this.#pending.has(k)),
      };
      markOutputsCreated(this.#pending, this.#paymentCredential, txBody, tx.getId(), details);
      for (const subTx of txBody.subTransactions()?.values() ?? []) {
        markOutputsCreated(
          this.#pending,
          this.#paymentCredential,
          subTx.body(),
          subTx.getId(),
          details,
        );
      }
    } else {
      // If submission returned an error, the TX may or may not
      // have reached the mempool. Free the inputs so we can try
      // spending them again; we'll stop tracking them once they
      // appear on-chain, and this way we don't accidentally lock
      // them for no reason until the TTL expires
      for (const input of tx.body().inputs().values()) {
        this.#reserved.delete(txInKey(input));
      }
    }
    return result;
  }
}

class WalletTracker extends ChainIndex<UtxoSet> {
  #paymentCredential: Credential;
  constructor(
    paymentCredential: Credential,
    startSlot: Slot,
    startUtxos: TransactionUnspentOutput[],
  ) {
    super(
      startSlot,
      new Map(
        startUtxos.map(
          (utxo) =>
            [
              txInKey(utxo.input()),
              {
                input: utxo.input(),
                output: utxo.output(),
                validBefore: null,
                dependsOn: [],
              },
            ] as const,
        ),
      ),
    );
    this.#paymentCredential = paymentCredential;
  }

  protected doApplyTransaction(tx: Transaction, value: UtxoSet) {
    const applyTx = (txId: TransactionId, txBody: TransactionBody | SubTransactionBody) => {
      for (const input of txBody.inputs().values()) {
        markSpent(value, input);
      }
      markOutputsCreated(value, this.#paymentCredential, txBody, txId, null);
    };

    const txBody = tx.body();
    if (!tx.isValid()) {
      // A transaction that failed phase-2 validation, sub-transactions and all,
      // only spends its collateral and creates its collateral return, which
      // follows the regular outputs.
      for (const input of txBody.collateral()?.values() ?? []) {
        markSpent(value, input);
      }
      const collateralReturn = txBody.collateralReturn();
      if (collateralReturn) {
        markCreated(
          value,
          this.#paymentCredential,
          collateralReturn,
          tx.getId(),
          BigInt(txBody.outputs().length),
          null,
        );
      }
      return;
    }
    for (const subTx of txBody.subTransactions()?.values() ?? []) {
      applyTx(subTx.getId(), subTx.body());
    }
    applyTx(tx.getId(), txBody);
  }

  protected copyValue(value: UtxoSet): UtxoSet {
    return new Map(value);
  }
}
