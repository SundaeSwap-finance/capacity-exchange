import {
  Address,
  CborReader,
  CborSet,
  CborWriter,
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
import { CardanoChainStateService, ChainFollower, SubmitTxResult } from './chain-state';
import { Ed25519KeyPair } from '../../config/cardanoKeys';
import { sign } from 'node:crypto';

interface OwnedOutput {
  input: TransactionInput;
  output: TransactionOutput;
  validBefore: Slot | null;
  dependsOn: string[];
}
type UtxoSet = Map<string, OwnedOutput>;

const txInId = (txIn: TransactionInput): string => {
  return `${txIn.transactionId()}:${txIn.index()}`;
};

const markSpent = (utxos: UtxoSet, input: TransactionInput) => {
  utxos.delete(txInId(input));
};

interface PendingOutputDetails {
  validBefore: Slot;
  dependsOn: string[];
}

const markCreated = (
  utxos: UtxoSet,
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
  utxos.set(txInId(input), {
    input,
    output,
    ...(details || { validBefore: null, dependsOn: [] }),
  });
};

const markOutputsCreated = (
  utxos: UtxoSet,
  paymentCredential: Credential,
  txBody: TransactionBody | SubTransactionBody,
  txId: TransactionId,
  details: PendingOutputDetails | null,
) => {
  let index = 0n;
  for (const output of txBody.outputs()) {
    markCreated(utxos, paymentCredential, output, txId, index, details);
    index += 1n;
  }
};

interface WalletState {
  tracker: WalletTracker;
  reserved: Map<string, Slot>;
  pending: Map<string, OwnedOutput>;
  slot: Slot;
}

export class CardanoWalletService implements ChainFollower {
  #address: Address;
  #paymentCredential: Credential;
  #keys: Ed25519KeyPair;
  #chainState: CardanoChainStateService;
  #state: WalletState | null;

  constructor(address: Address, keys: Ed25519KeyPair, chainState: CardanoChainStateService) {
    const paymentCredential = address.getProps().paymentPart;
    if (!paymentCredential) {
      throw new Error('Address must contain payment credential');
    }
    this.#address = address;
    this.#paymentCredential = paymentCredential;
    this.#keys = keys;
    this.#chainState = chainState;
    this.#state = null;
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
    const state = this.#state;
    if (!state) {
      return [];
    }
    const slot = state.slot;
    const live = new Map(state.tracker.currentValue());
    for (const [k, v] of state.pending) {
      if (
        (v.validBefore === null || v.validBefore > slot) &&
        v.dependsOn.every((i) => live.has(i))
      ) {
        live.set(k, v);
      }
    }
    return [...live]
      .filter(([k, _]) => !this.#isReserved(k, state))
      .map(([_, v]) => new TransactionUnspentOutput(v.input, v.output));
  }

  /** The ADA held across the wallet's UTxOs, in lovelace. */
  lovelace(): bigint {
    const state = this.#state;
    if (!state) {
      return 0n;
    }
    let total = 0n;
    for (const utxo of state.tracker.currentValue().values()) {
      total += utxo.output.amount().coin();
    }
    return total;
  }

  followerName(): string {
    return 'wallet';
  }

  initState(slot: Slot): void {
    this.#state = {
      tracker: new WalletTracker(this.#paymentCredential, slot, []),
      reserved: new Map(),
      pending: new Map(),
      slot,
    };
  }

  loadState(reader: CborReader) {
    // TODO
    const slot = Slot(Number(reader.readInt()));
    this.#state = {
      tracker: new WalletTracker(this.#paymentCredential, slot, []),
      reserved: new Map(),
      pending: new Map(),
      slot,
    };
  }

  saveState(writer: CborWriter) {
    const state = this.#requireState();
    writer.writeInt(state.slot);
  }

  async onRollForward(header: PartialBlockHeader, txs: Transaction[]) {
    const state = this.#requireState();
    state.slot = header.slot;
    const landed = new Set<string>();
    for (const tx of txs) {
      state.tracker.applyTransaction(header.slot, tx);
      landed.add(tx.getId());
      for (const subTx of tx.body().subTransactions()?.values() ?? []) {
        landed.add(subTx.getId());
      }
    }
    // these entries appeared on chain or expired, they're not pending any more.
    // Match on the landed tx ids too: an output created and spent within the
    // same block never shows up in the tracker.
    for (const [txoId, txo] of state.pending) {
      if (
        (txo.validBefore !== null && txo.validBefore <= state.slot) ||
        landed.has(txo.input.transactionId()) ||
        state.tracker.currentValue().has(txoId)
      ) {
        state.pending.delete(txoId);
      }
    }
    // prune any TXOs which have been reserved for longer than tracked history
    const oldestSlot = state.tracker.oldestSlot();
    for (const [txoId, until] of state.reserved) {
      if (until <= oldestSlot) {
        state.reserved.delete(txoId);
      }
    }
  }

  #isReserved(txoId: string, state: WalletState): boolean {
    const until = state.reserved.get(txoId);
    return until !== undefined && until > state.slot;
  }

  async onRollBackward(header: PartialBlockHeader) {
    const state = this.#requireState();
    state.slot = header.slot;
    state.tracker.rollBack(header.slot);
  }

  async signAndSubmitTx(tx: Transaction): Promise<SubmitTxResult> {
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
    const until = txBody.ttl();
    if (!until) {
      return { status: 'error', reason: 'transaction has no TTL' };
    }
    const subTxs = [...(txBody.subTransactions()?.values() ?? [])];
    // Every input the transaction consumes, sub-transactions included.
    const inputTxoIds = [txBody, ...subTxs.map((subTx) => subTx.body())].flatMap((body) =>
      [...body.inputs().values()].map(txInId),
    );

    // Track all UTXOs this depends on, in case they get rolled back or otherwise disappear
    const state = this.#requireState();
    const confirmed = state.tracker.currentValue();
    const dependsOn = inputTxoIds.filter((k) => confirmed.has(k) || state.pending.has(k));

    if (inputTxoIds.some((txoId) => this.#isReserved(txoId, state))) {
      return {
        status: 'error',
        reason: 'transaction input is already reserved',
      };
    }
    for (const txoId of inputTxoIds) {
      state.reserved.set(txoId, until);
    }
    const result = await this.#chainState.submit(tx);
    if (result.status === 'ok') {
      const details = { validBefore: until, dependsOn };
      markOutputsCreated(state.pending, this.#paymentCredential, txBody, tx.getId(), details);
      for (const subTx of subTxs) {
        markOutputsCreated(
          state.pending,
          this.#paymentCredential,
          subTx.body(),
          subTx.getId(),
          details,
        );
      }
    } else if (result.reachedMempool === false) {
      // If submission returned an error, the TX may or may not
      // have reached the mempool. If we _know_ it didn't, free the inputs so we
      // can try spending them again. If not, keep them reserved so we don't
      // accidentally double-spend. Worst-case scenario, the inputs are unavailable
      // until the TTL expires.
      for (const txoId of inputTxoIds) {
        state.reserved.delete(txoId);
      }
    }
    return result;
  }

  #requireState(): WalletState {
    if (!this.#state) {
      throw new Error('WalletState not initialized');
    }
    return this.#state;
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
              txInId(utxo.input()),
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

  protected doApplyTransaction(tx: Transaction, utxos: UtxoSet) {
    const applyTx = (txId: TransactionId, txBody: TransactionBody | SubTransactionBody) => {
      for (const input of txBody.inputs().values()) {
        markSpent(utxos, input);
      }
      markOutputsCreated(utxos, this.#paymentCredential, txBody, txId, null);
    };

    const txBody = tx.body();
    if (!tx.isValid()) {
      // A transaction that failed phase-2 validation, sub-transactions and all,
      // only spends its collateral and creates its collateral return, which
      // follows the regular outputs.
      for (const input of txBody.collateral()?.values() ?? []) {
        markSpent(utxos, input);
      }
      const collateralReturn = txBody.collateralReturn();
      if (collateralReturn) {
        markCreated(
          utxos,
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

  protected copyValue(utxos: UtxoSet): UtxoSet {
    return new Map(utxos);
  }
}
