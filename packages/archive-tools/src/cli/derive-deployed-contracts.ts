#!/usr/bin/env bun

import { Command } from 'commander';
import { createLogger, runCli } from '@sundaeswap/capacity-exchange-nodejs';
import { S3Store } from '../aws/s3-store.js';
import { loadDeployRecordAt } from '../archive-reads.js';
import { readContractCompiles } from '../compiles.js';
import { CONTRACT_NAMES, type ContractDeployRecord, type DeployedContracts } from '../deployments.js';

const logger = createLogger(import.meta);

interface CliOpts {
  bucket: string;
  compiles: string;
}

function parseArgs(argv: string[]): CliOpts {
  const program = new Command();
  program
    .name('derive-deployed-contracts')
    .description("Assemble the per-network contract address bundle from the env's deploys of the pinned compiles.")
    .requiredOption('--bucket <name>', 'Source s3 bucket')
    .requiredOption('--compiles <file>', 'Pin file naming the compile sha per contract (contract-compiles.json)');
  program.parse(argv);
  return program.opts<CliOpts>();
}

async function main(): Promise<DeployedContracts> {
  const cli = parseArgs(process.argv);
  const compiles = readContractCompiles(cli.compiles);
  const store = new S3Store({ bucket: cli.bucket });

  // The pinned compile decides which deploy each contract uses, not the pointer, so a
  // deploy goes live together with the code that pins it.
  const records = Object.fromEntries(
    await Promise.all(
      CONTRACT_NAMES.map(async (c) => {
        const record = await loadDeployRecordAt(store, c, compiles[c]);
        logger.info(
          { contract: c, sha: record.sha, address: record.address, network: record.network },
          'loaded deploy record'
        );
        return [c, record] as const;
      })
    )
  ) as Record<(typeof CONTRACT_NAMES)[number], ContractDeployRecord>;

  // Derive network from the records. Assert all agree, otherwise the bucket holds an
  // inconsistent mix of envs and the bundle would be a lie.
  const networks = new Set(CONTRACT_NAMES.map((c) => records[c].network));
  if (networks.size !== 1) {
    const detail = CONTRACT_NAMES.map((c) => `${c}=${records[c].network}`).join(', ');
    throw new Error(`records disagree on network in bucket '${cli.bucket}': ${detail}`);
  }
  const network = networks.values().next().value as string;

  return { network, ...records };
}

runCli(main, { pretty: true });
