import { assetLabel, formatValue } from '../cardano/value.js';
import { formatAda, formatAsset, plain, short, shortAddress } from '../log.js';
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
import { computeBalance, type ResolveInput } from './batch.js';
import { decodeSubTransaction, imbalance, type SubTransaction, subTransactionSigners } from './subtx.js';

export interface ShowLabels {
  /** Address bytes (hex) -> a human label such as "caller" or "CES". */
  addresses?: Map<string, string>;
  /** Who built the batch. Omitted when the source was never recorded. */
  batchLabel?: string;
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

function resolveOrUndefined(resolve: ResolveInput | undefined): (input: TxInput) => Value | undefined {
  return (input) => {
    try {
      return resolve?.(input);
    } catch {
      return undefined;
    }
  };
}

/** A sub-transaction's inputs and outputs, under whatever heading the caller gives it. */
export function showSubTransaction(
  heading: string,
  sub: SubTransaction,
  resolve: ResolveInput | undefined,
  addresses?: Map<string, string>
): void {
  const lookup = resolveOrUndefined(resolve);
  plain(heading);
  plain('  inputs');
  for (const input of sub.inputs) {
    plain(inputLine(input, lookup(input), addresses, 'caller'));
  }
  plain('  outputs');
  for (const output of sub.outputs) {
    plain(outputLine(output, addresses));
  }
}

/**
 * What an offer gives its batch and what it needs from it — the property that makes it a
 * babel-fee offer. Needs every input resolved, so it says so rather than guess when one is not.
 */
export function showImbalance(sub: SubTransaction, resolve: ResolveInput | undefined): void {
  plain('');
  plain('IMBALANCE (consumed − produced)');
  const lookup = resolveOrUndefined(resolve);
  if (!resolve || sub.inputs.some((i) => !lookup(i))) {
    plain('  unavailable: not every input could be looked up (spent, or --offline)');
    return;
  }
  const delta = imbalance(sub, resolve);
  const offered = [...delta.assets].filter(([, q]) => q > 0n);
  const needed = [...delta.assets].filter(([, q]) => q < 0n);
  const offeredValue = { lovelace: delta.lovelace > 0n ? delta.lovelace : 0n, assets: new Map(offered) };
  const neededValue = {
    lovelace: delta.lovelace < 0n ? -delta.lovelace : 0n,
    assets: new Map(needed.map(([u, q]) => [u, -q])),
  };
  // Only the non-zero parts: "0.000000 ADA + 0.013436 tokenA" reads as if ADA were offered.
  const render = (v: Value): string => {
    const parts = [
      ...(v.lovelace !== 0n ? [`${formatAda(v.lovelace)} ADA`] : []),
      ...[...v.assets].map(([unit, q]) => `${formatAsset(q)} ${assetLabel(unit)}`),
    ];
    return (parts.join('  +  ') || 'nothing').padEnd(40);
  };
  plain(`  offers   ${render(offeredValue)}   what the batch keeps`);
  plain(`  needs    ${render(neededValue)}   what the batch supplies`);
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

  const lookup = resolveOrUndefined(resolve);

  plain(`TOP-LEVEL${labels.batchLabel ? `   ${labels.batchLabel}` : ''}`);
  plain('  inputs');
  for (const input of inputs) {
    plain(inputLine(input, lookup(input), labels.addresses, 'CES'));
  }
  plain('  outputs');
  for (const output of outputs) {
    plain(outputLine(output, labels.addresses));
  }
  plain(`  fee${' '.repeat(18)}${formatAda(fee)} ADA`);

  subs.forEach((sub: SubTransaction, i: number) => {
    const signers = subTransactionSigners(sub.items).map((k) => short(k, 4));
    plain('');
    showSubTransaction(
      `SUB-TRANSACTION ${i + 1}/${subs.length}   offer ${short(sub.bodyHash, 6)}    ` +
        `signed by ${signers.join(', ') || '(none)'}`,
      sub,
      resolve,
      labels.addresses
    );
  });

  if (resolve) {
    const balance = computeBalance(inputs, outputs, subs, fee, resolve);
    plain('');
    plain('BALANCE');
    plain(`  consumed        ${formatValue(balance.consumed)}`);
    plain(`  produced        ${formatValue(balance.produced)}`);
    plain(balance.balances ? '  ✓ batch balances' : '  ✗ BATCH DOES NOT BALANCE');
  }
}
