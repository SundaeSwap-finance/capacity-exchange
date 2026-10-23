import { assetLabel, formatValue } from '../cardano/value.js';
import { formatAda, formatAsset, plain, short, shortAddress } from '../log.js';
import type { Value } from '../cardano/value.js';
import { outputValue, type Transaction, type TxInput, type TxOutput } from './codec.js';
import { computeBalance, type ResolveInput } from './batch.js';
import { imbalance, type SubTransaction, subTransactionSigners } from './subtx.js';

export interface ShowLabels {
  /** Bech32 address -> a human label such as "caller" or "CES". */
  addresses?: Map<string, string>;
  /** Who built the batch. Omitted when the source was never recorded. */
  batchLabel?: string;
}

function outputLine(output: TxOutput, labels?: Map<string, string>): string {
  const address = output.address().toBech32();
  const label = labels?.get(address) ?? '';
  return `    ${shortAddress(address, 16, 6).padEnd(24)} ${formatValue(outputValue(output)).padEnd(44)} ${label}`;
}

function inputLine(input: TxInput, value: Value | undefined, label = ''): string {
  const ref = `${short(input.transactionId(), 6)}#${input.index()}`;
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
  const body = sub.body();
  plain(heading);
  plain('  inputs');
  for (const input of body.inputs().values()) {
    plain(inputLine(input, lookup(input), 'caller'));
  }
  plain('  outputs');
  for (const output of body.outputs()) {
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
  if (
    !resolve ||
    sub
      .body()
      .inputs()
      .values()
      .some((i) => !lookup(i))
  ) {
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
export function showTransaction(tx: Transaction, resolve: ResolveInput | undefined, labels: ShowLabels = {}): void {
  const body = tx.body();
  const inputs = body.inputs().values();
  const outputs = body.outputs();
  const fee = body.fee();
  const subs = [...(body.subTransactions()?.values() ?? [])];

  const lookup = resolveOrUndefined(resolve);

  plain(`TOP-LEVEL${labels.batchLabel ? `   ${labels.batchLabel}` : ''}`);
  plain('  inputs');
  for (const input of inputs) {
    plain(inputLine(input, lookup(input), 'CES'));
  }
  plain('  outputs');
  for (const output of outputs) {
    plain(outputLine(output, labels.addresses));
  }
  plain(`  fee${' '.repeat(18)}${formatAda(fee)} ADA`);

  subs.forEach((sub: SubTransaction, i: number) => {
    const signers = subTransactionSigners(sub).map((k) => short(k, 4));
    plain('');
    showSubTransaction(
      `SUB-TRANSACTION ${i + 1}/${subs.length}   offer ${short(sub.getId(), 6)}    ` +
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
