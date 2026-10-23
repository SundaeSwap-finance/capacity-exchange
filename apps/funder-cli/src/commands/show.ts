import { CardanoCli } from '../cardano/cli.js';
import { emptyValue, type Value } from '../cardano/value.js';
import type { Config } from '../config.js';
import { decodeTx, inputRef, readEnvelope, type TxInput } from '../tx/codec.js';
import { showTransaction } from '../tx/show.js';
import { batchSourceLabel, parseBatchSource } from './state.js';

export interface ShowOptions {
  offline?: boolean;
}

/** Renders a batch, including the sub-transactions stock tooling hides. */
export function runShow(config: Config, file: string, options: ShowOptions): void {
  const envelope = readEnvelope(file);
  const tx = decodeTx(envelope.cborHex);
  // Who built the batch is recorded by `fund`. If it is missing, say nothing rather than guess.
  const batchLabel = batchSourceLabel(parseBatchSource(envelope.description));

  if (options.offline) {
    showTransaction(tx, undefined, { batchLabel });
    return;
  }

  const cli = new CardanoCli(config);
  const body = tx.body();
  const subs = body.subTransactions()?.values() ?? [];
  const refs = [...body.inputs().values(), ...subs.flatMap((s) => s.body().inputs().values())].map(inputRef);

  const resolved = new Map<string, Value>();
  for (const utxo of cli.queryUtxoByRefs(refs)) {
    resolved.set(`${utxo.txHash}#${utxo.index}`, utxo.value);
  }
  const resolve = (input: TxInput): Value => {
    const value = resolved.get(inputRef(input));
    if (!value) {
      throw new Error(`unresolved input ${inputRef(input)}`);
    }
    return value;
  };

  // The top-level outputs are the exchange's. An offer's outputs go wherever its signer chose,
  // which the transaction does not say, so they are left unlabelled rather than guessed at.
  const addresses = new Map<string, string>();
  for (const output of body.outputs()) {
    addresses.set(output.address().toBech32(), 'CES');
  }
  showTransaction(tx, refs.every((r) => resolved.has(r)) ? resolve : undefined, {
    addresses,
    batchLabel,
  });
}

export { emptyValue };
