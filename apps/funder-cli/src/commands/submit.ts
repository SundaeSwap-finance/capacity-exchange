import { CardanoCli } from '../cardano/cli.js';
import { formatDuration, waitForInclusion } from '../cardano/inclusion.js';
import type { Config } from '../config.js';
import { step, warn } from '../log.js';

export interface SubmitOptions {
  wait?: boolean;
  timeout: string;
  pollInterval: string;
}

/**
 * Submits the assembled bundle. The node validates both witness sets independently.
 *
 * Acceptance is not inclusion: the transaction sits in the mempool until a block takes it,
 * observed at a few minutes on this network. The message says so rather than letting a
 * successful submit read as a confirmed transfer.
 */
export async function runSubmit(config: Config, signedPath: string, options: SubmitOptions): Promise<void> {
  const cli = new CardanoCli(config);

  step('submit', `cardano-cli dijkstra transaction submit --testnet-magic ${config.testnetMagic}`);
  const txid = cli.txid(signedPath);
  cli.submit(signedPath);
  step('submit', `accepted into mempool — txid ${txid}`);

  if (!options.wait) {
    step('submit', 'pending: inclusion takes a few minutes on this network, not seconds');
    step('submit', `poll with: ces-fund status --txid ${txid} --wait`);
    return;
  }

  await reportWait(cli, txid, options);
}

/** Shared by `submit --wait` and `status --txid --wait`. */
export async function reportWait(
  cli: CardanoCli,
  txid: string,
  options: { timeout: string; pollInterval: string }
): Promise<void> {
  const timeoutSeconds = Number(options.timeout);
  step('wait', `polling every ${options.pollInterval}s for up to ${formatDuration(timeoutSeconds)}`);
  const result = await waitForInclusion(cli, txid, {
    timeoutSeconds,
    pollSeconds: Number(options.pollInterval),
    onPoll: (elapsed, state) => {
      if (elapsed > 0) {
        step('wait', `${formatDuration(elapsed)} — ${state}`);
      }
    },
  });

  if (result.state === 'included') {
    step('wait', `included after ${formatDuration(result.waitedSeconds ?? 0)} — txid ${txid}`);
    return;
  }
  if (result.state === 'pending') {
    warn(`still pending after ${formatDuration(result.waitedSeconds ?? 0)}. It is in the mempool; keep waiting.`);
    return;
  }
  warn(
    `after ${formatDuration(result.waitedSeconds ?? 0)} the transaction is neither in the mempool ` +
      'nor visible in the UTxO set. It was dropped, or it landed and its outputs are already spent.'
  );
}
