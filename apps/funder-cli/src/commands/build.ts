import { CardanoCli } from '../cardano/cli.js';
import type { Config } from '../config.js';
import { assetLabel, formatValue, unitToCliAsset } from '../cardano/value.js';
import { decodeBech32Address } from '../ces/simulate.js';
import { formatAsset, step, wrote } from '../log.js';
import { readEnvelope } from '../tx/codec.js';
import { minUtxoLovelace } from '../tx/subtx.js';
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
 * Builds the caller's transaction with a zero fee and works out how much ADA capacity it will
 * need. The draft is deliberately provisional, and deliberately unbalanced: it carries a change
 * output the caller cannot yet fund, because the lovelace for it comes from the exchange.
 *
 * `build-raw` is given UTxO references, not values, so it cannot check balance and does not
 * try; `calculate-min-fee` only measures the serialised size. The bundle is balanced once, by
 * `splice`, over the parent and the sub-transaction together.
 */
export function runBuild(config: Config, options: BuildOptions): void {
  const cli = new CardanoCli(config);
  const selection = readJson<Selection>(options.selection, 'UTxO selection');
  const { unit, quantity } = parseSend(options.send);

  const held = BigInt(selection.assets[unit] ?? '0');
  if (held < quantity) {
    throw new Error(`Caller holds ${held} of ${assetLabel(unit)}, cannot send ${quantity}`);
  }

  // The exchange is paid in this token out of the caller's own change, so some has to stay
  // behind. How much is not known until `quote`, but none at all can never be enough.
  const leftover = held - quantity;
  if (leftover === 0n) {
    throw new Error(
      `Sending all ${held} of ${assetLabel(unit)} leaves nothing to pay the exchange with. ` +
        'Send less than the full holding so the change output can cover the price.'
    );
  }

  const txIn = `${selection.txHash}#${selection.index}`;
  const lovelace = BigInt(selection.lovelace);
  const changeAddressBytes = decodeBech32Address(selection.address);
  const changeValue = { lovelace: 0n, assets: new Map([[unit, leftover]]) };
  const changeLovelace = minUtxoLovelace(
    { address: changeAddressBytes, value: changeValue },
    cli.queryProtocolParams().utxoCostPerByte
  );

  // The recipient keeps the caller's own lovelace; the change output's minimum is what the
  // exchange has to release on top of the fee. No shell is involved, so the multi-asset part
  // carries no quotes of its own.
  const txOuts = [
    '--tx-out',
    `${options.to}+${lovelace}+${quantity} ${unitToCliAsset(unit)}`,
    '--tx-out',
    `${selection.address}+${changeLovelace}+${leftover} ${unitToCliAsset(unit)}`,
  ];

  step(
    'build',
    `input   ${selection.txHash.slice(0, 6)}…#${selection.index}   ${formatValue({ lovelace, assets: new Map([[unit, held]]) })}`
  );

  const draftPath = workPath(config, ARTIFACTS.draft);
  cli.buildRaw(['--tx-in', txIn, ...txOuts, '--fee', '0', '--out-file', draftPath]);

  const ppPath = workPath(config, ARTIFACTS.protocolParams);
  cli.writeProtocolParams(ppPath);

  const size = Buffer.from(readEnvelope(draftPath).cborHex, 'hex').length;
  const fee = cli.calculateMinFee(draftPath, ppPath, 1);
  const capacity = fee + changeLovelace;

  step('build', `${size} bytes, fee placeholder 0`);
  wrote('build', draftPath);
  step('build', `sending ${formatAsset(quantity)} ${assetLabel(unit)} to ${options.to}`);
  step('build', `change  ${formatAsset(leftover)} ${assetLabel(unit)} back to the caller, to pay the exchange from`);
  step('build', `estimated fee: ${fee} lovelace`);
  step('build', `change output needs ${changeLovelace} lovelace the caller does not have`);
  step('build', `capacity to request: ${fee} + ${changeLovelace} = ${capacity} lovelace`);
  step('build', `next: ces-fund quote --selection ${options.selection} --fee-estimate ${capacity} --ces-url <url>`);
}
