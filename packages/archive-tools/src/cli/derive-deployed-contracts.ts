#!/usr/bin/env bun

import { Command } from 'commander';
import { createLogger, runCli } from '@sundaeswap/capacity-exchange-nodejs';
import { S3Store } from '../aws/s3-store.js';
import { loadCurrentDeployRecord } from '../archive-reads.js';
import { CONTRACT_NAMES, type ContractDeployRecord, type DeployedContracts } from '../deployments.js';

const logger = createLogger(import.meta);

interface CliOpts {
  bucket: string;
}

function parseArgs(argv: string[]): CliOpts {
  const program = new Command();
  program
    .name('derive-deployed-contracts')
    .description("Assemble the per-network contract address bundle from the state bucket's deploy records.")
    .requiredOption('--bucket <name>', 'Source s3 bucket');
  program.parse(argv);
  return program.opts<CliOpts>();
}

async function main(): Promise<DeployedContracts> {
  const cli = parseArgs(process.argv);
  const store = new S3Store({ bucket: cli.bucket });

  // Load each contract's current deploy record in parallel. Each lookup is two reads:
  // (1) read deployments/<contract>.json to get the current sha and address,
  // (2) read archive/<sha>/<contract>/deploys/<address>.json to get the record itself.
  const records = Object.fromEntries(
    await Promise.all(
      CONTRACT_NAMES.map(async (c) => {
        const record = await loadCurrentDeployRecord(store, c);
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
