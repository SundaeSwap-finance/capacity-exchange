import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CardanoCli } from '../cardano/cli.js';
import { unitToCliAsset } from '../cardano/value.js';
import type { Config } from '../config.js';
import { formatAda, formatAsset, step, warn } from '../log.js';
import { minUtxoLovelace } from '../tx/subtx.js';
import { decodeBech32Address } from '../ces/simulate.js';
import { ARTIFACTS, signingKeyPath, walletDir, workPath } from './state.js';

export interface MintOptions {
  callerWallet: string;
  assetName: string;
  quantity: string;
  sweepTo?: string;
}

/**
 * Mints the demo token and puts the caller into the state the demo is about: one UTxO holding
 * the token and *exactly* its minimum lovelace, with every spare lovelace swept away.
 *
 * Both halves happen in one transaction, so a single faucet drop sets up both parties: the
 * caller ends up unable to pay a fee, and the sweep target (the stand-in exchange) ends up
 * with the ADA it will later sell back.
 */
export function runMint(config: Config, options: MintOptions): void {
  const cli = new CardanoCli(config);
  const keyFile = signingKeyPath(options.callerWallet);
  const dir = walletDir(options.callerWallet);
  const address = cli.deriveAddress(keyFile, dir);

  const utxos = cli.queryUtxo(address);
  const adaOnly = utxos.filter((u) => u.value.assets.size === 0);
  if (adaOnly.length === 0) {
    throw new Error(`${address} has no ADA UTxO to mint from. Fund it from the faucet first.`);
  }
  const funding = adaOnly.reduce((a, b) => (b.value.lovelace > a.value.lovelace ? b : a));
  step('mint', `funding ${funding.txHash.slice(0, 6)}…#${funding.index}  (${formatAda(funding.value.lovelace)} ADA)`);

  // A native "sig" policy: the caller's own key is the only one that may mint.
  const keyHash = cli.keyHash(keyFile, dir);
  const policyFile = join(dir, 'policy.script');
  writeFileSync(policyFile, `${JSON.stringify({ type: 'sig', keyHash }, null, 2)}\n`);
  const policyId = cli.policyId(policyFile);
  const assetNameHex = Buffer.from(options.assetName).toString('hex');
  const unit = `${policyId}${assetNameHex}`;
  step('mint', `policy ${policyId}  (${options.assetName})`);

  const quantity = BigInt(options.quantity);
  const pp = cli.queryProtocolParams();
  const tokenOutput = {
    address: decodeBech32Address(address),
    value: { lovelace: 0n, assets: new Map([[unit, quantity]]) },
  };
  const minLovelace = minUtxoLovelace(tokenOutput, pp.utxoCostPerByte);
  step('mint', `token output pinned at its minimum: ${formatAda(minLovelace)} ADA`);

  const mintSpec = `${quantity} ${unitToCliAsset(unit)}`;
  const tokenOut = `${address}+${minLovelace}+${mintSpec}`;
  const sweepTo = options.sweepTo;
  if (!sweepTo) {
    warn('no --sweep-to given: the caller keeps its change and will still be able to pay fees.');
  }

  const draftPath = workPath(config, 'mint.draft.tx');
  const signedPath = workPath(config, 'mint.signed.tx');
  const ppPath = workPath(config, ARTIFACTS.protocolParams);
  cli.writeProtocolParams(ppPath);

  const build = (fee: bigint): void => {
    const change = funding.value.lovelace - minLovelace - fee;
    if (change < 0n) {
      throw new Error('Funding UTxO cannot cover the token output and fee');
    }
    const outs = [
      '--tx-out',
      tokenOut,
      ...(sweepTo ? ['--tx-out', `${sweepTo}+${change}`] : ['--tx-out', `${address}+${change}`]),
    ];
    cli.buildRaw([
      '--tx-in',
      `${funding.txHash}#${funding.index}`,
      ...outs,
      '--mint',
      mintSpec,
      '--mint-script-file',
      policyFile,
      '--fee',
      String(fee),
      '--out-file',
      draftPath,
    ]);
  };

  // Build once at zero fee to measure, then rebuild with the real one.
  build(0n);
  const fee = cli.calculateMinFee(draftPath, ppPath, 1);
  build(fee);
  const change = funding.value.lovelace - minLovelace - fee;
  step(
    'mint',
    `fee ${fee} lovelace; ${formatAda(change)} ADA ${sweepTo ? `swept to ${sweepTo}` : 'returned as change'}`
  );

  cli.sign(draftPath, keyFile, signedPath);
  const txid = cli.txid(signedPath);
  cli.submit(signedPath);
  step('mint', `submitted — txid ${txid}`);
  step('mint', `minted ${formatAsset(quantity)} ${options.assetName}`);
  step('mint', `unit: ${unit}`);
  step('mint', `next: ces-fund balance --caller-wallet ${options.callerWallet}`);
}
