import * as fs from 'fs';
import * as path from 'path';
import { Option, program } from 'commander';
import { runCli, withAppContextFromEnv } from '../cli.js';
import {
  parseSigningKey,
  rotateVerifierKeys,
  type RotateVerifierKeysResult,
  type RotationMode,
} from '../rotateVerifierKeys.js';

interface Options {
  contractAddress: string;
  outDir: string;
  signingKeyFile: string;
  circuits?: string[];
  removeLegacy?: boolean;
  reinsert?: boolean;
  dryRun?: boolean;
}

function main(): Promise<RotateVerifierKeysResult> {
  program
    .name('rotate-verifier-keys')
    .description(
      "Adds a contract's recompiled (ledger 9) verifier keys through its maintenance authority, " +
        'next to the keys it was deployed with. Run again with --remove-legacy to drop the old keys.'
    )
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview, preprod, mainnet)')
    .requiredOption('--contract-address <hex>', 'Address of the deployed contract')
    .requiredOption('--out-dir <path>', "The contract's compiled output directory (holding keys/*.verifier)")
    .requiredOption(
      '--signing-key-file <path>',
      'File holding a maintenance authority signing key: 64 hex characters, or { "tag", "value" } JSON'
    )
    .option('--circuits <names...>', 'Only these circuits (default: every circuit with a local key)')
    .addOption(
      new Option('--remove-legacy', 'Remove the pre-fork (v3) keys instead; requires the insert to have landed')
    )
    .addOption(
      new Option(
        '--reinsert',
        'Testing only: remove and re-insert each current (v4) key unchanged, exercising the maintenance path'
      ).conflicts('removeLegacy')
    )
    .option('--dry-run', 'Prove and balance the maintenance transaction without submitting it')
    .parse();

  const [networkId] = program.args;
  const opts = program.opts<Options>();
  const mode: RotationMode = opts.reinsert ? 'reinsert' : opts.removeLegacy ? 'remove-legacy' : 'insert';
  const signingKey = parseSigningKey(fs.readFileSync(opts.signingKeyFile, 'utf-8'));

  return withAppContextFromEnv(networkId, (ctx) =>
    rotateVerifierKeys(ctx, {
      contractAddress: opts.contractAddress,
      outDir: path.resolve(opts.outDir),
      signingKey,
      mode,
      circuits: opts.circuits,
      dryRun: opts.dryRun,
    })
  );
}

runCli(main, { pretty: true });
