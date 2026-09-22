import { formatValue } from '../cardano/value.js';
import { formatAda, plain, short, shortAddress } from '../log.js';
import type { Value } from '../cardano/value.js';
import {
  asArray,
  BODY_FEE,
  BODY_INPUTS,
  BODY_OUTPUTS,
  BODY_SUB_TRANSACTIONS,
  bytesToHex,
  type DecodedTx,
  readInputs,
  readOutputs,
  toBigInt,
  type TxInput,
  type TxOutput,
} from './codec.js';
import { computeBalance, type ResolveInput } from './splice.js';
import { decodeSubTransaction, type SubTransaction, subTransactionSigners } from './subtx.js';

export interface ShowLabels {
  /** Address bytes (hex) -> a human label such as "caller" or "CES". */
  addresses?: Map<string, string>;
  /** Provenance tag for each sub-transaction. Omitted when the source was never recorded. */
  subLabel?: string;
}

function labelFor(address: Uint8Array, labels?: Map<string, string>): string {
  return labels?.get(bytesToHex(address)) ?? '';
}

function outputLine(output: TxOutput, labels?: Map<string, string>): string {
  const label = labelFor(output.address, labels);
  const addr = shortAddress(`addr(${bytesToHex(output.address).slice(0, 12)}…)`, 22, 0);
  return `    ${addr.padEnd(24)} ${formatValue(output.value).padEnd(44)} ${label}`;
}

function inputLine(input: TxInput, value: Value | undefined, labels?: Map<string, string>, label = ''): string {
  const ref = `${short(input.txHash, 6)}#${input.index}`;
  const rendered = value ? formatValue(value) : '(unresolved)';
  return `    ${ref.padEnd(24)} ${rendered.padEnd(44)} ${label}`;
}

/**
 * Renders a nested transaction. `cardano-cli debug transaction view` silently omits body key
 * 23, so without this the sub-transaction is invisible in every stock tool.
 */
export function showTransaction(tx: DecodedTx, resolve: ResolveInput | undefined, labels: ShowLabels = {}): void {
  const inputs = readInputs(tx.body, BODY_INPUTS);
  const outputs = readOutputs(tx.body, BODY_OUTPUTS);
  const fee = toBigInt(tx.body.get(BODY_FEE));
  const subs = asArray(tx.body.get(BODY_SUB_TRANSACTIONS)).map((raw) => decodeSubTransaction(raw as unknown[]));

  const resolveOrUndefined = (input: TxInput): Value | undefined => {
    try {
      return resolve?.(input);
    } catch {
      return undefined;
    }
  };

  plain('TOP-LEVEL');
  plain('  inputs');
  for (const input of inputs) {
    plain(inputLine(input, resolveOrUndefined(input), labels.addresses, 'caller'));
  }
  plain('  outputs');
  for (const output of outputs) {
    plain(outputLine(output, labels.addresses));
  }
  plain(`  fee${' '.repeat(18)}${formatAda(fee)} ADA`);

  subs.forEach((sub: SubTransaction, i: number) => {
    const signers = subTransactionSigners(sub.items).map((k) => short(k, 4));
    const tag = labels.subLabel ? `   ${labels.subLabel}` : '';
    plain('');
    plain(
      `SUB-TRANSACTION ${i + 1}/${subs.length}        body ${short(sub.bodyHash, 6)}    ` +
        `signed by ${signers.join(', ') || '(none)'}${tag}`
    );
    plain('  inputs');
    for (const input of sub.inputs) {
      plain(inputLine(input, resolveOrUndefined(input), labels.addresses, 'CES'));
    }
    plain('  outputs');
    for (const output of sub.outputs) {
      plain(outputLine(output, labels.addresses));
    }
  });

  if (resolve) {
    const balance = computeBalance(inputs, outputs, subs, fee, resolve);
    plain('');
    plain('BALANCE');
    plain(`  consumed        ${formatValue(balance.consumed)}`);
    plain(`  produced        ${formatValue(balance.produced)}`);
    plain(balance.balances ? '  ✓ bundle balances' : '  ✗ BUNDLE DOES NOT BALANCE');
  }
}
