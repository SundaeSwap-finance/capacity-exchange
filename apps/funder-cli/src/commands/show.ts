import { CardanoCli } from '../cardano/cli.js';
import { emptyValue, type Value } from '../cardano/value.js';
import type { Config } from '../config.js';
import {
  asArray,
  BODY_INPUTS,
  BODY_SUB_TRANSACTIONS,
  bytesToHex,
  decodeTx,
  readEnvelope,
  readInputs,
  type TxInput,
} from '../tx/codec.js';
import { showTransaction } from '../tx/show.js';
import { decodeSubTransaction } from '../tx/subtx.js';

export interface ShowOptions {
  offline?: boolean;
}

/** Renders a nested transaction, including the sub-transactions stock tooling hides. */
export function runShow(config: Config, file: string, options: ShowOptions): void {
  const tx = decodeTx(readEnvelope(file).cborHex);

  if (options.offline) {
    showTransaction(tx, undefined, { simulated: true });
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

  // Label the outputs by address so the printout says who gets what.
  const addresses = new Map<string, string>();
  for (const sub of subs) {
    for (const output of sub.outputs) {
      addresses.set(bytesToHex(output.address), 'CES');
    }
  }
  showTransaction(tx, refs.every((r) => resolved.has(r)) ? resolve : undefined, {
    addresses,
    simulated: true,
  });
}

export { emptyValue };
