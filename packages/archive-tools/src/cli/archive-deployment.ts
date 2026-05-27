#!/usr/bin/env bun

import { readFileSync } from 'fs';
import { Command } from 'commander';
import { createLogger, runCli } from '@sundaeswap/capacity-exchange-nodejs';
import { S3Store } from '../aws/s3-store.js';
import { toDeployRecord, type ContractDeployRecord, type DeploymentInput } from '../deployments.js';
import { verifyArchiveExists } from '../archive-reads.js';
import {
  writePointer,
  writeRecord,
  type WritePointerResult,
  type WriteRecordResult,
} from '../deployment-writes.js';

const logger = createLogger(import.meta);

export interface ArchiveDeploymentOpts {
  network: string;
  contract: string;
  bucket: string;
  input: DeploymentInput;
}

export interface ArchiveDeploymentResult {
  network: string;
  contract: string;
  record: ContractDeployRecord;
  recordWrite: WriteRecordResult;
  pointerWrite: WritePointerResult;
}

/** Verifies the (sha, contract) archive exists, writes the immutable deploy record, then advances the pointer. */
export async function archiveDeployment(opts: ArchiveDeploymentOpts): Promise<ArchiveDeploymentResult> {
  const record = toDeployRecord(opts.input, opts.network);
  logger.info({ network: opts.network, contract: opts.contract, record }, 'archiving deploy record');

  const store = new S3Store({ bucket: opts.bucket });
  await verifyArchiveExists(store, opts.contract, record.sha);
  logger.info({ sha: record.sha, contract: opts.contract }, 'archive existence verified');

  const recordWrite = await writeRecord(store, opts.contract, record);
  if (recordWrite.status === 'conflict') {
    throw new Error(
      `record already exists at s3://${opts.bucket}/${recordWrite.key} and differs from the proposed record. ` +
      `Investigate via bucket versioning before deleting and retrying.`
    );
  }
  logger.info({ key: recordWrite.key, status: recordWrite.status }, 'record write done');

  const pointerWrite = await writePointer(store, opts.contract, {
    address: record.address,
    sha: record.sha,
  });
  logger.info(
    { key: pointerWrite.key, status: pointerWrite.status, current: pointerWrite.newCurrent },
    'pointer write done'
  );

  return { network: opts.network, contract: opts.contract, record, recordWrite, pointerWrite };
}

interface CliOpts {
  network: string;
  contract: string;
  bucket: string;
  address: string;
  txHash: string;
  sourceSha: string;
  publicFile?: string;
}

/** Builds the commander program and parses argv into the typed CLI opts. */
function parseArgs(argv: string[]): CliOpts {
  const program = new Command();
  program
    .name('archive-deployment')
    .description('Write an immutable S3 record of a contract deploy plus update the per-contract pointer.')
    .requiredOption('--network <id>', 'Network identifier')
    .requiredOption('--contract <name>', 'Contract name in kebab-case')
    .requiredOption('--bucket <name>', 'Destination s3 bucket')
    .requiredOption('--address <hex>', 'On-chain contract address')
    .requiredOption('--tx-hash <hex>', 'On-chain deploy tx hash')
    .requiredOption('--source-sha <sha>', 'Git sha of the contract source. Must have a matching archive in the bucket.')
    .option('--public-file <path>', 'Path to a JSON file with the contract-specific public payload. Defaults to {}.');
  program.parse(argv);
  return program.opts<CliOpts>();
}

/** Loads and validates the public payload from --public-file. Returns {} when the flag is absent. */
function resolvePublicPayload(cli: CliOpts): Record<string, unknown> {
  if (!cli.publicFile) {
    return {};
  }
  let raw: string;
  try {
    raw = readFileSync(cli.publicFile, 'utf-8');
  } catch (err) {
    throw new Error(`--public-file ${cli.publicFile}: ${(err as NodeJS.ErrnoException).message}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`--public-file ${cli.publicFile}: not valid JSON (${(err as Error).message})`);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`--public-file ${cli.publicFile}: must be a JSON object`);
  }
  return parsed as Record<string, unknown>;
}

/** CLI entrypoint: parses argv, packs into a DeploymentInput, and runs archiveDeployment. */
async function main(): Promise<ArchiveDeploymentResult> {
  const cli = parseArgs(process.argv);
  return archiveDeployment({
    network: cli.network,
    contract: cli.contract,
    bucket: cli.bucket,
    input: {
      address: cli.address,
      txHash: cli.txHash,
      sourceSha: cli.sourceSha,
      publicPayload: resolvePublicPayload(cli),
    },
  });
}

runCli(main, { pretty: true });
