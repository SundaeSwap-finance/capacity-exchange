import { CardanoCli } from '../cardano/cli.js';
import type { Config } from '../config.js';
import { assetLabel, formatValue, unitToCliAsset } from '../cardano/value.js';
import { formatAsset, step, wrote } from '../log.js';
import { readEnvelope } from '../tx/codec.js';
import { ARTIFACTS, readJson, type Selection, workPath } from './state.js';

export interface BuildOptions {
  callerWallet: string;
  selection: string;
  send: string;
  to: string;
}

/** `--send 100000000:policyhexname` */
function parseSend(spec: string): { unit: string; quantity: bigint } {
  const [quantity, unit] = spec.split(':');
  if (!quantity || !unit) {
    throw new Error(`--send must look like <quantity>:<unit>, got '${spec}'`);
  }
  return { unit, quantity: BigInt(quantity) };
}

/**
 * Builds the caller's transaction with a zero fee and estimates what it will cost. The draft
 * is deliberately provisional: the price is not known yet, and the token quantity that will
 * later be deducted does not change the transaction's size, so the estimate holds.
 */
export function runBuild(config: Config, options: BuildOptions): void {
  const cli = new CardanoCli(config);
  const selection = readJson<Selection>(options.selection, 'UTxO selection');
  const { unit, quantity } = parseSend(options.send);

  const held = BigInt(selection.assets[unit] ?? '0');
  if (held < quantity) {
    throw new Error(`Caller holds ${held} of ${assetLabel(unit)}, cannot send ${quantity}`);
  }

  const txIn = `${selection.txHash}#${selection.index}`;
  const lovelace = BigInt(selection.lovelace);
  // The caller forwards their whole UTxO: they have no spare ADA to make a second output with.
  // No shell is involved, so the multi-asset part carries no quotes of its own.
  const txOut = `${options.to}+${lovelace}+${quantity} ${unitToCliAsset(unit)}`;

  step(
    'build',
    `input   ${selection.txHash.slice(0, 6)}…#${selection.index}   ${formatValue({ lovelace, assets: new Map([[unit, held]]) })}`
  );

  const draftPath = workPath(config, ARTIFACTS.draft);
  cli.buildRaw(['--tx-in', txIn, '--tx-out', txOut, '--fee', '0', '--out-file', draftPath]);

  const ppPath = workPath(config, ARTIFACTS.protocolParams);
  cli.writeProtocolParams(ppPath);

  const size = Buffer.from(readEnvelope(draftPath).cborHex, 'hex').length;
  const fee = cli.calculateMinFee(draftPath, ppPath, 1);

  step('build', `${size} bytes, fee placeholder 0`);
  wrote('build', draftPath);
  step('build', `estimated fee: ${fee} lovelace`);
  step('build', `sending ${formatAsset(quantity)} ${assetLabel(unit)} to ${options.to}`);
  step('build', `next: ces-fund quote --selection ${options.selection} --fee-estimate ${fee} --ces-url <url>`);
}
