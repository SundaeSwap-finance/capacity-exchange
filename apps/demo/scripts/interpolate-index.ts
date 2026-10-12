#!/usr/bin/env bun

// Fills dist/index.html's placeholder with a network's runtime config. Run after
// `vite build`, before uploading to S3. Any URL --config leaves unset resolves from
// the per-network defaults in the bundle.

import { chmodSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Command } from 'commander';
import { SUPPORTED_NETWORK_IDS } from '@sundaeswap/capacity-exchange-core';
import { createLogger, runCli } from '@sundaeswap/capacity-exchange-nodejs';
import { APP_CONFIG_PLACEHOLDER, fillAppConfig } from './fill-app-config';
import { parseAppConfig, type AppConfig } from '../src/config/appConfig';

const logger = createLogger(import.meta);

const DEMO_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

// One list, so this cannot drift from what the browser accepts.
const NETWORK_IDS = SUPPORTED_NETWORK_IDS;

interface CliOpts {
  networkId: string;
  config?: string;
  dist: string;
}

function parseArgs(argv: string[]): CliOpts {
  const program = new Command();
  program
    .name('interpolate-index')
    .description("Inline a network's runtime config into a built demo bundle.")
    .requiredOption('--network-id <id>', `Network to configure the bundle for: ${NETWORK_IDS.join(' ')}`)
    .option('--config <file>', 'JSON file of overrides for the network defaults, e.g. indexerUrl and indexerWsUrl')
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

/** Reads the overrides file. The network comes from --network-id alone, so the file
 * cannot name a second one. */
function readOverrides(file: string): Record<string, unknown> {
  let overrides: unknown;
  try {
    overrides = JSON.parse(readFileSync(file, 'utf-8'));
  } catch (err) {
    throw new Error(`cannot read config file '${file}': ${(err as Error).message}`);
  }
  if (typeof overrides !== 'object' || overrides === null || Array.isArray(overrides)) {
    throw new Error(`config file '${file}' must hold a JSON object`);
  }
  if ('networkId' in overrides) {
    throw new Error(`config file '${file}' must not set networkId. Pass --network-id instead.`);
  }
  return overrides as Record<string, unknown>;
}

/** Validates the page config as the browser will, so a bad deploy fails here rather
 * than on load. The browser drops keys it does not know, so a misspelt override is
 * an error here instead of a silent fallback to the default. */
function buildAppConfig(networkId: string, configFile: string | undefined): AppConfig {
  const overrides = configFile ? readOverrides(configFile) : {};
  const appConfig = parseAppConfig({ ...overrides, networkId });
  const unknown = Object.keys(overrides).filter((key) => !(key in appConfig));
  if (unknown.length > 0) {
    throw new Error(`config file '${configFile}' has unknown keys: ${unknown.join(', ')}`);
  }
  return appConfig;
}

async function main(): Promise<{ networkId: string; indexFile: string }> {
  const { networkId, config: configFile, dist } = parseArgs(process.argv);
  if (!NETWORK_IDS.includes(networkId)) {
    throw new Error(`unknown network id '${networkId}'. Known networks: ${NETWORK_IDS.join(' ')}`);
  }
  const appConfig = buildAppConfig(networkId, configFile);

  const indexFile = join(dist, 'index.html');
  let html: string;
  try {
    html = readFileSync(indexFile, 'utf-8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      throw new Error(`missing index file '${indexFile}'`);
    }
    throw err;
  }

  try {
    writeAtomically(indexFile, fillAppConfig(html, appConfig));
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
