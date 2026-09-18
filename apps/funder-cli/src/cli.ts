#!/usr/bin/env bun
import { Command, Option } from 'commander';
import { resolveConfig, type GlobalOptions } from './config.js';
import { runInit } from './commands/init.js';
import { runBalance } from './commands/balance.js';
import { runMint } from './commands/mint.js';
import { runBuild } from './commands/build.js';
import { runQuote } from './commands/quote.js';
import { runOffer } from './commands/offer.js';
import { runSplice } from './commands/splice.js';
import { runSign } from './commands/sign.js';
import { runSubmit } from './commands/submit.js';
import { runShow } from './commands/show.js';
import { runStatus } from './commands/status.js';

const program = new Command();

program
  .name('ces-fund')
  .description(
    'Funds a Cardano transaction with ADA bought from a Capacity Exchange, using a Dijkstra ' +
      'nested transaction. Wraps cardano-cli for everything except assembling the nested ' +
      'transaction, which cardano-cli cannot do.'
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
  .description('build the unbalanced parent transaction and estimate its fee')
  .requiredOption('--caller-wallet <dir>')
  .requiredOption('--selection <path>', 'selection.json written by `balance`')
  .requiredOption('--send <quantity:unit>', 'native asset to send')
  .requiredOption('--to <address>', 'recipient address')
  .action((opts) => runBuild(config(), opts));

program
  .command('quote')
  .description('ask one or more exchanges what they charge to cover the fee')
  .requiredOption('--ces-url <url...>', 'exchange base URL (repeatable)')
  .requiredOption('--fee-estimate <lovelace>')
  .requiredOption('--selection <path>', 'selection.json written by `balance`')
  .action((opts) => runQuote(config(), opts));

program
  .command('offer')
  .description('obtain the funding sub-transaction (exactly one mode must be chosen)')
  .argument('<quote>', 'quote.json written by `quote`')
  .option('--simulate-ces', 'build the offer locally instead of calling an exchange')
  .option('--simulated-ces-signing-key <file>', 'stand-in exchange signing key')
  .option('--ces-url <url>', 'exchange to request a real offer from')
  .option('--margin <lovelace>', 'safety margin the stand-in adds on top of its computed pad', '2000')
  .option('--offer-ttl <seconds>', 'how long the simulated offer claims to be valid', '60')
  .action((quote, opts) => runOffer(config(), quote, opts));

program
  .command('splice')
  .description('verify the offer, merge it into the parent, and balance the bundle')
  .requiredOption('--draft <path>', 'parent.draft.tx written by `build`')
  .requiredOption('--quote <path>', 'quote.json written by `quote`')
  .requiredOption('--offer <path>', 'offer.json written by `offer`')
  .action((opts) => runSplice(config(), opts));

program
  .command('sign')
  .description("sign the parent with the caller's key")
  .argument('<tx>', 'parent.nested.tx written by `splice`')
  .requiredOption('--caller-wallet <dir>')
  .action((tx, opts) => runSign(config(), tx, opts));

program
  .command('submit')
  .description('submit the bundle (acceptance is not inclusion)')
  .argument('<tx>', 'signed transaction written by `sign`')
  .option('--wait', 'poll until the transaction is included')
  .option('--timeout <seconds>', 'how long --wait polls before giving up', '3600')
  .option('--poll-interval <seconds>', 'seconds between polls', '10')
  .action((tx, opts) => runSubmit(config(), tx, opts));

program
  .command('show')
  .description('render a nested transaction, including sub-transactions')
  .argument('<file>', 'transaction file')
  .option('--offline', 'skip resolving inputs (no balance proof)')
  .action((file, opts) => runShow(config(), file, opts));

program
  .command('status')
  .description('show what addresses hold, and/or whether a transaction has been included')
  .option('--address <addr...>', 'addresses to report on')
  .option('--txid <txid>', 'transaction to check for inclusion')
  .option('--wait', 'poll until that transaction is included')
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
