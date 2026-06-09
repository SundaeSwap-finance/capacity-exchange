#!/usr/bin/env bun

import { join } from 'path';
import { Command } from 'commander';
import { createLogger, runCli } from '@sundaeswap/capacity-exchange-nodejs';
import { S3Store } from '../aws/s3-store.js';
import { downloadPrefix } from '../aws/s3-fs.js';
import { archiveKey, COMPILE_OUTPUT_SUBDIRS } from '../archive.js';
import { verifyArchiveExists } from '../archive-reads.js';

const logger = createLogger(import.meta);

interface CliOpts {
  bucket: string;
  sha: string;
  contract: string;
  out: string;
}

function parseArgs(argv: string[]): CliOpts {
  const program = new Command();
  program
    .name('archive-read')
    .description("Download a contract's compile-output subdirs from the state bucket into a local out/ dir.")
    .requiredOption('--bucket <name>', 'Source s3 bucket')
    .requiredOption('--sha <sha>', 'Git sha to read. Archive at archive/<sha>/<contract>/ must exist')
    .requiredOption('--contract <name>', 'Contract name in kebab-case')
    .requiredOption(
      '--out <path>',
      `Local destination directory (will receive ${COMPILE_OUTPUT_SUBDIRS.map((s) => `${s}/`).join(', ')})`
    );
  program.parse(argv);
  return program.opts<CliOpts>();
}

async function main(): Promise<{ contract: string; sha: string; out: string; downloaded: number }> {
  const cli = parseArgs(process.argv);
  const store = new S3Store({ bucket: cli.bucket });

  // Fail fast if the (sha, contract) archive isn't in the bucket.
  await verifyArchiveExists(store, cli.contract, cli.sha);
  const archivePrefix = archiveKey.prefix({ sha: cli.sha, contract: cli.contract });

  // Pull each canonical subdir in parallel.
  const counts = await Promise.all(
    COMPILE_OUTPUT_SUBDIRS.map(async (subdir) => {
      const keys = await downloadPrefix(store, `${archivePrefix}/${subdir}`, join(cli.out, subdir));
      logger.info({ subdir, count: keys.length }, 'downloaded subdir');
      return { subdir, count: keys.length };
    })
  );

  // An empty subdir means archive-write was interrupted partway. Refuse to silently succeed.
  const empty = counts.filter((c) => c.count === 0).map((c) => c.subdir);
  if (empty.length > 0) {
    throw new Error(
      `archive at sha=${cli.sha} contract=${cli.contract} has empty subdirs [${empty.join(', ')}] in bucket '${cli.bucket}'. Possible partial archive-write.`
    );
  }
  return { contract: cli.contract, sha: cli.sha, out: cli.out, downloaded: counts.reduce((a, c) => a + c.count, 0) };
}

runCli(main, { pretty: true });
