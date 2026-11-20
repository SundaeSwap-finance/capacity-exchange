import { existsSync } from 'node:fs';
import { CardanoCli } from '../cardano/cli.js';
import { checkInclusion, formatDuration, waitForInclusion } from '../cardano/inclusion.js';
import { assetLabel } from '../cardano/value.js';
import type { Config } from '../config.js';
import { formatAsset, plain, step, warn } from '../log.js';
import { ARTIFACTS, readJson, type StoredSubmission, workPath } from './state.js';

export interface StatusOptions {
  address?: string[];
  txid?: string;
  offer?: string;
  wait?: boolean;
  timeout: string;
  pollInterval: string;
}

/**
 * Reports what each named address holds, and/or whether a transaction or offer has been
 * included. An offer is followed on chain by its own id, since its outputs land under it;
 * what the exchange said when it took the offer is shown alongside, but only as its view.
 */
export async function runStatus(config: Config, options: StatusOptions): Promise<void> {
  const cli = new CardanoCli(config);

  if (options.txid) {
    await report(cli, options.txid, options);
  }

  if (options.offer) {
    const submission = readSubmission(config, options.offer);
    if (submission) {
      // The server has no status route; the chain is the only place to look.
      step('status', `${submission.url} said ${submission.state}`);
    }
    await report(cli, options.offer, options);
  }

  for (const address of options.address ?? []) {
    const utxos = cli.queryUtxo(address);
    const totals = new Map<string, bigint>();
    let lovelace = 0n;
    for (const utxo of utxos) {
      lovelace += utxo.value.lovelace;
      for (const [unit, quantity] of utxo.value.assets) {
        totals.set(unit, (totals.get(unit) ?? 0n) + quantity);
      }
    }
    const assets = [...totals].map(([unit, q]) => `${formatAsset(q)} ${assetLabel(unit)}`).join(', ');
    plain(`  ${address.slice(0, 20)}…   ${formatAsset(lovelace)} ADA${assets ? `   ${assets}` : ''}`);
  }
}

/** `fund` records where it sent the offer; use that, if it is the same offer. */
function readSubmission(config: Config, offerId: string): StoredSubmission | undefined {
  const path = workPath(config, ARTIFACTS.submission);
  if (!existsSync(path)) {
    return undefined;
  }
  const submission = readJson<StoredSubmission>(path, 'submission');
  return submission.offerId === offerId ? submission : undefined;
}

async function report(
  cli: CardanoCli,
  txid: string,
  options: { wait?: boolean; timeout: string; pollInterval: string; mempoolTxid?: string }
): Promise<void> {
  if (options.wait) {
    await reportWait(cli, txid, options);
    return;
  }
  const { state } = checkInclusion(cli, txid, options.mempoolTxid ?? txid);
  step('status', `${txid} — ${state}`);
  if (state !== 'included') {
    step('status', 'add --wait to poll until it lands');
  }
}

/** Shared by `fund --wait` and `status --wait`. */
export async function reportWait(
  cli: CardanoCli,
  txid: string,
  options: { timeout: string; pollInterval: string; mempoolTxid?: string }
): Promise<void> {
  const timeoutSeconds = Number(options.timeout);
  step('wait', `polling every ${options.pollInterval}s for up to ${formatDuration(timeoutSeconds)}`);
  const result = await waitForInclusion(cli, txid, {
    mempoolTxid: options.mempoolTxid,
    timeoutSeconds,
    pollSeconds: Number(options.pollInterval),
    onPoll: (elapsed, state) => {
      if (elapsed > 0) {
        step('wait', `${formatDuration(elapsed)} — ${state}`);
      }
    },
  });

  if (result.state === 'included') {
    step('wait', `included after ${formatDuration(result.waitedSeconds ?? 0)} — ${txid}`);
    return;
  }
  if (result.state === 'pending') {
    warn(`still pending after ${formatDuration(result.waitedSeconds ?? 0)}. It is in the mempool; keep waiting.`);
    return;
  }
  warn(
    `after ${formatDuration(result.waitedSeconds ?? 0)} it is neither in the mempool nor visible in the ` +
      'UTxO set. It was dropped, it has not been batched yet, or it landed and its outputs are already spent.'
  );
}
