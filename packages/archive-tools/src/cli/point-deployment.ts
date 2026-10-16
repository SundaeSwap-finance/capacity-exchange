#!/usr/bin/env bun

import { Command } from 'commander';
import { createLogger, runCli } from '@sundaeswap/capacity-exchange-nodejs';
import { S3Store } from '../aws/s3-store.js';
import { archiveKey } from '../archive.js';
import { writePointer, type WritePointerResult } from '../deployment-writes.js';

const logger = createLogger(import.meta);

interface CliOpts {
  bucket: string;
  contract: string;
  sha: string;
  address: string;
}

function parseArgs(argv: string[]): CliOpts {
  const program = new Command();
  program
    .name('point-deployment')
    .description(
      "Point a contract's deployments/<contract>.json at an existing deploy record, keeping the old one in history."
    )
    .requiredOption('--bucket <name>', 'State s3 bucket')
    .requiredOption('--contract <name>', 'Contract name in kebab-case')
    .requiredOption('--sha <sha>', 'Compile sha of the deploy record')
    .requiredOption('--address <hex>', 'Contract address of the deploy record');
  program.parse(argv);
  return program.opts<CliOpts>();
}

async function main(): Promise<WritePointerResult> {
  const cli = parseArgs(process.argv);
  const store = new S3Store({ bucket: cli.bucket });

  // A pointer must name a deploy that was recorded, so refuse a dangling target.
  const recordKey = archiveKey.deploy({ sha: cli.sha, contract: cli.contract, address: cli.address });
  if (!(await store.exists(recordKey))) {
    throw new Error(`no deploy record at s3://${cli.bucket}/${recordKey}. Record the deploy before pointing at it.`);
  }

  const result = await writePointer(store, cli.contract, { address: cli.address, sha: cli.sha });
  logger.info({ key: result.key, status: result.status, current: result.newCurrent }, 'pointer write done');
  return result;
}

runCli(main, { pretty: true });
