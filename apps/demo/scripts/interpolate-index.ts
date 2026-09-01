#!/usr/bin/env bun

// Fills dist/index.html's placeholder with a network's runtime config. Run after
// `vite build`, before uploading to S3. The network id is the whole config, since
// every URL resolves from the per-network defaults in the bundle.

import { chmodSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { createLogger, runCli } from '@sundaeswap/capacity-exchange-nodejs';
import { APP_CONFIG_PLACEHOLDER, fillAppConfig } from './fill-app-config';

const logger = createLogger(import.meta);

const DEMO_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

// The networks the app accepts, so a bad id fails here rather than in the browser.
const NETWORK_IDS = ['undeployed', 'preview', 'preprod', 'mainnet'] as const;

interface CliOpts {
  networkId: string;
  dist: string;
}

function parseArgs(argv: string[]): CliOpts {
  const program = new Command();
  program
    .name('interpolate-index')
    .description("Inline a network's runtime config into a built demo bundle.")
    .requiredOption('--network-id <id>', `Network to configure the bundle for: ${NETWORK_IDS.join(' ')}`)
    .option('--dist <dir>', 'Built bundle directory', join(DEMO_DIR, 'dist'));
  program.parse(argv);
  return program.opts<CliOpts>();
}

/** Writes through a temp file in the same dir, so the rename cannot truncate. Mode is
 * carried over, since a fresh file is 0600. */
function writeAtomically(file: string, contents: string): void {
  const mode = statSync(file).mode & 0o777;
  const temp = join(dirname(file), `.${process.pid}.${Math.random().toString(36).slice(2)}`);
  try {
    writeFileSync(temp, contents, { flag: 'wx' });
    chmodSync(temp, mode);
    renameSync(temp, file);
  } catch (err) {
    rmSync(temp, { force: true });
    throw err;
  }
}

async function main(): Promise<{ networkId: string; indexFile: string }> {
  const { networkId, dist } = parseArgs(process.argv);
  if (!(NETWORK_IDS as readonly string[]).includes(networkId)) {
    throw new Error(`unknown network id '${networkId}'. Known networks: ${NETWORK_IDS.join(' ')}`);
  }

  const indexFile = join(dist, 'index.html');
  let html: string;
  try {
    html = readFileSync(indexFile, 'utf-8');
  } catch {
    throw new Error(`missing index file '${indexFile}'`);
  }

  try {
    writeAtomically(indexFile, fillAppConfig(html, { networkId }));
  } catch (err) {
    // A missing placeholder means the page was already filled. Anything else is a
    // write failure, and saying "already interpolated" about EACCES misdirects.
    const message = (err as Error).message;
    const hint = message.includes(APP_CONFIG_PLACEHOLDER) ? ' Already interpolated?' : '';
    throw new Error(`'${indexFile}' ${message}${hint}`);
  }

  logger.info({ networkId, indexFile }, 'interpolated runtime config');
  return { networkId, indexFile };
}

runCli(main, { pretty: true });
