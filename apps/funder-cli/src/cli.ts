#!/usr/bin/env bun
import { Command, Option } from 'commander';
import { resolveConfig, type GlobalOptions } from './config.js';
import { runInit } from './commands/init.js';
import { runBalance } from './commands/balance.js';
import { runMint } from './commands/mint.js';
import { runBuild } from './commands/build.js';
import { runQuote } from './commands/quote.js';
import { runCommit } from './commands/commit.js';
import { runFund } from './commands/fund.js';
import { runShow } from './commands/show.js';
import { runShowOffer } from './commands/showOffer.js';
import { runStatus } from './commands/status.js';

const program = new Command();

program
  .name('ces-fund')
  .description(
    'Funds a Cardano transfer with ADA bought from a Capacity Exchange. The caller signs a ' +
      'Dijkstra sub-transaction offer; the exchange carries it in a batch it pays for and ' +
      'submits. Wraps cardano-cli for everything except sub-transactions, which it cannot build.'
  )
  .addOption(new Option('--cardano-cli <path>', 'path to the cardano-cli binary').env('CARDANO_CLI'))
  .addOption(new Option('--socket-path <path>', 'cardano-node socket').env('CARDANO_NODE_SOCKET_PATH'))
  .addOption(new Option('--testnet-magic <n>', 'network magic').env('CARDANO_TESTNET_MAGIC'))
  .addOption(new Option('--work-dir <dir>', 'where intermediate artifacts are kept').env('CES_FUND_WORK_DIR'))
  .addOption(new Option('--cli-timeout <seconds>', 'bound on any single cardano-cli call').env('CES_FUND_CLI_TIMEOUT'));

const config = () => resolveConfig(program.opts<GlobalOptions>());

program
  .command('init')
  .description('create the caller, stand-in exchange, and recipient wallets')
  .requiredOption('--caller-wallet <dir>')
  .requiredOption('--simulated-ces-wallet <dir>')
  .requiredOption('--recipient-wallet <dir>')
  .option(
    '--faucet-url <url>',
    'faucet to point the operator at',
    'https://faucet.leios.play.dev.cardano.org/basic-faucet'
  )
  .action((opts) => runInit(config(), opts));

program
  .command('mint')
  .description('mint the demo token and sweep the spare ADA, leaving the caller unable to pay a fee')
  .requiredOption('--caller-wallet <dir>')
  .option('--asset-name <name>', 'token name', 'tokenA')
  .option('--quantity <n>', 'how many units to mint', '100000000')
  .option('--sweep-to <address>', "where the caller's spare ADA goes (use the stand-in exchange)")
  .action((opts) => runMint(config(), opts));

program
  .command('balance')
  .description("show the caller's UTxOs and how much of their ADA is actually spendable")
  .requiredOption('--caller-wallet <dir>')
  .action((opts) => runBalance(config(), opts));

program
  .command('build')
  .description("draft the caller's offer, before the price is known, and work out the ADA it needs")
  .requiredOption('--selection <path>', 'selection.json written by `balance`')
  .requiredOption('--send <quantity:unit>', 'native asset to send')
  .requiredOption('--to <address>', 'recipient address')
  .action((opts) => runBuild(config(), opts));

program
  .command('quote')
  .description('ask one or more exchanges what they charge for that capacity')
  .requiredOption('--ces-url <url...>', 'exchange base URL (repeatable)')
  .requiredOption('--capacity <lovelace>', 'the capacity `build` printed')
  .requiredOption('--selection <path>', 'selection.json written by `balance`')
  .action((opts) => runQuote(config(), opts));

program
  .command('commit')
  .description("commit the draft to a quote: take the price out of the caller's change and sign the offer")
  .requiredOption('--draft <path>', 'offer.draft.json written by `build`')
  .requiredOption('--quote <path>', 'quote.json written by `quote`')
  .requiredOption('--caller-wallet <dir>')
  .action((opts) => runCommit(config(), opts));

program
  .command('fund')
  .description('hand the offer to an exchange, which batches and submits it (exactly one mode must be chosen)')
  .argument('<offer>', 'offer.json written by `commit`')
  .requiredOption('--quote <path>', 'quote.json written by `quote`')
  .option('--simulate-ces', 'run the exchange side locally instead of calling one')
  .option('--simulated-ces-wallet <dir>', 'stand-in exchange wallet')
  .option('--ces-url <url>', 'exchange to submit the offer to')
  .option('--wait', 'then follow the chain until the offer is included')
  .option('--timeout <seconds>', 'how long polling runs before giving up', '3600')
  .option('--poll-interval <seconds>', 'seconds between polls', '10')
  .action((offer, opts) => runFund(config(), offer, opts));

program
  .command('show')
  .description('render a batch, including the sub-transactions stock tooling hides')
  .argument('<file>', 'transaction file')
  .option('--offline', 'skip resolving inputs (no balance proof)')
  .action((file, opts) => runShow(config(), file, opts));

program
  .command('show-offer')
  .description('render the offer, drafted by `build` or signed by `commit`, and what it offers and needs')
  .argument('<file>', 'offer.draft.json or offer.json')
  .option('--offline', 'skip resolving inputs (no imbalance)')
  .action((file, opts) => runShowOffer(config(), file, opts));

program
  .command('status')
  .description('show what addresses hold, and/or whether a transaction or offer has been included')
  .option('--address <addr...>', 'addresses to report on')
  .option('--txid <txid>', 'transaction to check for inclusion')
  .option('--offer <id>', 'offer to follow on chain, by the id `commit` printed')
  .option('--wait', 'poll until it is included')
  .option('--timeout <seconds>', 'how long --wait polls before giving up', '3600')
  .option('--poll-interval <seconds>', 'seconds between polls', '10')
  .action((opts) => runStatus(config(), opts));

async function main(): Promise<void> {
  await program.parseAsync();
}

main().catch((err: unknown) => {
  console.error(`\nerror: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
