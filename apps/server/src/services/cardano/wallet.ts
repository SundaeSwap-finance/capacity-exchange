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
import { readArray, readMap, readNullable, readSlot } from './cbor';

const WALLET_STATE_VERSION = 1n;

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

/** Writes a txo reference (a `txInId`) as an encoded TransactionInput. */
const writeTxoRef = (writer: CborWriter, id: string) => {
  const [txId, index] = id.split(':');
  const input = new TransactionInput(TransactionId(txId), BigInt(index));
  writer.writeEncodedValue(Buffer.from(input.toCbor(), 'hex'));
};

/** Reads a txo reference written by `writeTxoRef`, as a `txInId`. */
const readTxoRef = (reader: CborReader): string =>
  txInId(TransactionInput.fromCbor(HexBlob.fromBytes(reader.readEncodedValue())));

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
  #network: string;
  #address: Address;
  #paymentCredential: Credential;
  #keys: Ed25519KeyPair;
  #chainState: CardanoChainStateService;
  #state: WalletState | null;

  constructor(
    network: string,
    address: Address,
    keys: Ed25519KeyPair,
    chainState: CardanoChainStateService,
  ) {
    const paymentCredential = address.getProps().paymentPart;
    if (!paymentCredential) {
      throw new Error('Address must contain payment credential');
    }
    this.#network = network;
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
    return `wallet-${this.#network}-${this.#paymentCredential.hash}`;
  }

  initState(slot: Slot): void {
    this.#state = {
      tracker: new WalletTracker(this.#paymentCredential, [[slot, new Map()]]),
      reserved: new Map(),
      pending: new Map(),
      slot,
    };
  }

  /*
    persisted state structure: CBOR array with
     - version number
     - slot (slot)
     - utxoSetHistory (map<slot, index>)
     - utxoSets (array<array<index>>)
     - pendingUtxos (array<index>)
     - reservedUtxos (map<input, slot>)
     - txos (array<txo>)

    txo structure: CBOR array with
     - input (bytestring)
     - output (bytestring)
     - validBefore (slot | null)
     - dependsOn (array<input>)
  */

  loadState(reader: CborReader) {
    const readIndex = (r: CborReader) => Number(r.readInt());

    reader.readStartArray();

    // index 0: version tag
    if (reader.readInt() !== WALLET_STATE_VERSION) {
      throw new Error('unexpected wallet state version');
    }

    // index 1: slot
    const slot = readSlot(reader);

    // index 2: utxo set history
    const utxoSetHistory = readMap(reader, readSlot, readIndex);

    // index 3: utxo sets
    const rawUtxoSets = readArray(reader, (r) => readArray(r, readIndex));

    // index 4: pending utxos
    const pendingUtxos = readArray(reader, readIndex);

    // index 5: reserved utxos
    const reserved = readMap(reader, readTxoRef, readSlot);

    // index 6: txos
    const txos = readArray(reader, (r) => this.#readTxo(r));

    reader.readEndArray();

    // all raw data is parsed, now reconstruct history

    const utxoSets = rawUtxoSets.map((txoIndices) => {
      const utxoSet = new Map<string, OwnedOutput>();
      for (const txoIndex of txoIndices) {
        const txo = txos[txoIndex];
        utxoSet.set(txInId(txo.input), txo);
      }
      return utxoSet;
    });

    const history: [Slot, UtxoSet][] = [];
    for (const [slot, index] of utxoSetHistory) {
      history.push([slot, new Map(utxoSets[index])]);
    }

    const pending = new Map<string, OwnedOutput>();
    for (const index of pendingUtxos) {
      const txo = txos[index];
      pending.set(txInId(txo.input), txo);
    }

    this.#state = {
      tracker: new WalletTracker(this.#paymentCredential, history),
      reserved,
      pending,
      slot,
    };
  }

  #readTxo(reader: CborReader): OwnedOutput {
    reader.readStartArray();

    const input = TransactionInput.fromCbor(HexBlob.fromBytes(reader.readEncodedValue()));
    const output = TransactionOutput.fromCbor(HexBlob.fromBytes(reader.readEncodedValue()));
    const validBefore = readNullable(reader, readSlot);
    const dependsOn = readArray(reader, readTxoRef);

    reader.readEndArray();

    return {
      input,
      output,
      validBefore,
      dependsOn,
    };
  }

  saveState(writer: CborWriter) {
    // avoid duplicating massive payloads by storing indexes of things sometimes
    const intern = <T>(idFunc: (val: T) => string) => {
      const indexes = new Map<string, number>();
      const values: T[] = [];
      const addValue = (val: T) => {
        const id = idFunc(val);
        const existingIndex = indexes.get(id);
        if (existingIndex !== undefined) {
          return existingIndex;
        }
        const newIndex = values.length;
        indexes.set(id, newIndex);
        values.push(val);
        return newIndex;
      };
      const indexForId = (id: string) => indexes.get(id);
      return [values, addValue, indexForId] as const;
    };

    // everything is in an array
    writer.writeStartArray();

    // index 0: a version
    writer.writeInt(WALLET_STATE_VERSION);

    // index 1: the slot we reached
    const state = this.#requireState();
    writer.writeInt(state.slot);

    // index 2: the utxo set history
    const [utxoSets, addUtxoSet] = intern((set: UtxoSet) => [...set.keys()].join());
    writer.writeStartMap();
    for (const [slot, value] of state.tracker.history()) {
      writer.writeInt(slot);
      writer.writeInt(addUtxoSet(value));
    }
    writer.writeEndMap();

    // index 3: the utxo sets themselves
    const [txos, addTxo, txoIndex] = intern((txo: OwnedOutput) => txInId(txo.input));
    writer.writeStartArray();
    for (const utxoSet of utxoSets) {
      // each is stored as a list of txo indexes
      writer.writeStartArray();
      for (const txo of utxoSet.values()) {
        writer.writeInt(addTxo(txo));
      }
      writer.writeEndArray();
    }
    writer.writeEndArray();

    // index 4: the indices of the pending utxos
    writer.writeStartArray();
    for (const pending of state.pending.values()) {
      if (txoIndex(txInId(pending.input)) !== undefined) {
        // This output already landed within tracked history, while its submission was
        // in flight. The confirmed copy wins; dropping the pending one only hides the
        // output if a rollback undoes the landing, and its inputs stay reserved.
        continue;
      }
      writer.writeInt(addTxo(pending));
    }
    writer.writeEndArray();

    // index 5: the reserved utxos (and when they are reserved until)
    writer.writeStartMap();
    for (const [txoId, until] of state.reserved) {
      writeTxoRef(writer, txoId);
      writer.writeInt(until);
    }
    writer.writeEndMap();

    // index 6: interned txo bodies
    writer.writeStartArray();
    for (const txo of txos) {
      this.#writeTxo(writer, txo);
    }
    writer.writeEndArray();

    // that's all
    writer.writeEndArray();
  }

  #writeTxo(writer: CborWriter, txo: OwnedOutput) {
    writer.writeStartArray();

    // index 0: encoded input
    writer.writeEncodedValue(Buffer.from(txo.input.toCbor(), 'hex'));

    // index 1: encoded output
    writer.writeEncodedValue(Buffer.from(txo.output.toCbor(), 'hex'));

    // index 2: validBefore
    if (txo.validBefore === null) {
      writer.writeNull();
    } else {
      writer.writeInt(txo.validBefore);
    }

    // index 3: dependsOn
    writer.writeStartArray();
    for (const dep of txo.dependsOn) {
      writeTxoRef(writer, dep);
    }
    writer.writeEndArray();

    writer.writeEndArray();
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

    // Track all UTXOs this depends on, in case they get rolled back or otherwise disappear.
    // These are also the only inputs we reserve: guarding inputs we don't own is the caller's job.
    const state = this.#requireState();
    const confirmed = state.tracker.currentValue();
    const dependsOn = inputTxoIds.filter((k) => confirmed.has(k) || state.pending.has(k));

    if (dependsOn.some((txoId) => this.#isReserved(txoId, state))) {
      return {
        status: 'error',
        reason: 'transaction input is already reserved',
      };
    }
    for (const txoId of dependsOn) {
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
      for (const txoId of dependsOn) {
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
  constructor(paymentCredential: Credential, history: [Slot, UtxoSet][]) {
    super(history);
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
