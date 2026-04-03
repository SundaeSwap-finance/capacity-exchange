/**
 * Intended as a test of CES sponsorship flow for a counter contract `increment` transaction.
 * See `packages/server/scripts/test-sponsor.sh` test script, calling this CLI and validating the CES response.
 *
 * What it does:
 *   1. Builds an unproven `increment` call transaction for the deployed counter contract.
 *   2. Proves the transaction.
 *   3. POSTs the proven transaction (hex-encoded) to the CES server's `/api/sponsor` endpoint.
 *   4. Logs the CES response, indicating success or failure of the sponsored transaction.
 *
 * Usage:
 *   bun prove-and-sponsor.ts <networkId> <contractAddress> [--server-url <url>]
 *
 * Example:
 *   bun prove-and-sponsor.ts preview d425ea8f... --server-url http://localhost:3000
 *
 * Prerequisites:
 *   - A wallet mnemonic file (wallet-mnemonic.{networkId}.txt).
 *   - A running CES server with a funded DUST wallet (or CES peer fallback configured).
 *     (see `packages/server/run-servers.sh`)
 *   - The counter contract already deployed at the given address.
 */
import { program } from 'commander';
import { runCli, withAppContext, buildProviders } from '@capacity-exchange/midnight-node';
import { createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { CompiledCounterContract, CounterContract } from '../../lib/contract.js';
import { createLogger } from '@capacity-exchange/midnight-node';

const logger = createLogger(import.meta);

interface ProveAndSponsorOutput {
  bytes: number;
  sponsorResponse: unknown;
}

async function main(): Promise<ProveAndSponsorOutput> {
  program
    .name('counter:prove-and-sponsor')
    .description('Proves a counter increment tx and immediately calls the CES sponsor endpoint')
    .argument('<networkId>', 'Network ID (e.g., preview)')
    .argument('<contractAddress>', 'The address of the deployed counter contract')
    .option('--server-url <url>', 'CES server URL', 'http://localhost:3000')
    .parse();

  const [networkId, contractAddress] = program.args;
  const { serverUrl } = program.opts<{ serverUrl: string }>();

  return withAppContext(networkId, async (ctx) => {
    logger.info('Building unproven counter increment tx...');

    const providers = buildProviders<CounterContract>(ctx, './counter/out');

    const callTxData = await createUnprovenCallTx(providers, {
      contractAddress,
      compiledContract: CompiledCounterContract,
      circuitId: 'increment',
    });

    logger.info('Proving transaction...');
    const provenTx = await providers.proofProvider.proveTx(callTxData.private.unprovenTx);

    const provenTxHex = Buffer.from(provenTx.serialize()).toString('hex');
    logger.info(`Proved tx (${provenTxHex.length / 2} bytes), calling ${serverUrl}/api/sponsor...`);

    const res = await fetch(`${serverUrl}/api/sponsor`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provenTx: provenTxHex }),
    });

    const sponsorResponse = await res.json();
    if (!res.ok) {
      logger.error({ status: res.status, sponsorResponse }, 'Sponsor request failed');
    } else {
      logger.info({ status: res.status }, 'Sponsor request succeeded');
    }

    return { bytes: provenTxHex.length / 2, sponsorResponse };
  });
}

runCli(main, { pretty: true });