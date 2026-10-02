import { CardanoCli } from '../cardano/cli.js';
import {
  asArray,
  BODY_INPUTS,
  BODY_OUTPUTS,
  BODY_SUB_TRANSACTIONS,
  bytesToHex,
  decodeSubTransaction,
  decodeTx,
  emptyValue,
  readEnvelope,
  readInputs,
  readOutputs,
  type TxInput,
  type Value,
} from '@sundaeswap/capacity-exchange-cardano-tx';
import type { Config } from '../config.js';
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
  const subs = asArray(tx.body.get(BODY_SUB_TRANSACTIONS)).map((raw) => decodeSubTransaction(raw as unknown[]));
  const refs = [...readInputs(tx.body, BODY_INPUTS), ...subs.flatMap((s) => s.inputs)].map(
    (i) => `${i.txHash}#${i.index}`
  );

  const resolved = new Map<string, Value>();
  for (const utxo of cli.queryUtxoByRefs(refs)) {
    resolved.set(`${utxo.txHash}#${utxo.index}`, utxo.value);
  }
  const resolve = (input: TxInput): Value => {
    const value = resolved.get(`${input.txHash}#${input.index}`);
    if (!value) {
      throw new Error(`unresolved input ${input.txHash}#${input.index}`);
    }
    return value;
  };

  // The top-level outputs are the exchange's. An offer's outputs go wherever its signer chose,
  // which the transaction does not say, so they are left unlabelled rather than guessed at.
  const addresses = new Map<string, string>();
  for (const output of readOutputs(tx.body, BODY_OUTPUTS)) {
    addresses.set(bytesToHex(output.address), 'CES');
  }
  showTransaction(tx, refs.every((r) => resolved.has(r)) ? resolve : undefined, {
    addresses,
    batchLabel,
  });
}

export { emptyValue };
