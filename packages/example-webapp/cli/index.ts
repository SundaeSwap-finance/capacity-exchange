import { Command } from "commander";
import { resolveCesOnlyConfig, resolveCliConfig } from "./lib/config.ts";
import { isJsonMode, printJsonError, setJsonMode } from "./lib/output.ts";
import { runIncrement } from "./commands/increment.ts";
import { runBalances } from "./commands/balances.ts";
import { runPrices } from "./commands/prices.ts";
import process from "node:process";

const program = new Command();

program
  .name("ces-cli")
  .description(
    "Capacity Exchange CLI: CES-powered transactions and wallet utilities",
  )
  .version("1.0.0");

function addCommonOptions(cmd: Command): Command {
  return cmd
    .option(
      "--network <id>",
      'Network ID (default: from NETWORK_ID env or "preprod")',
    )
    .option(
      "--mnemonic <words>",
      "BIP39 mnemonic (default: from MNEMONIC env, wallet file, or interactive prompt)",
    )
    .option("--json", "Output as JSON instead of human-friendly format");
}

const incrementCmd = new Command("increment")
  .description("Increment a counter contract via CES (Capacity Exchange)")
  .option(
    "--exchange-url <url>",
    "CES exchange server URL (default: from CES_URL env)",
  )
  .option(
    "--contract-address <addr>",
    "Counter contract address (default: from .contracts.{network}.json)",
  )
  .option(
    "--currency <currency>",
    "Pre-select payment currency (skips selection prompt)",
  )
  .option("--auto-confirm", "Skip offer confirmation prompt");

addCommonOptions(incrementCmd);

incrementCmd.action(async (opts) => {
  setJsonMode(!!opts.json);
  try {
    const config = resolveCliConfig({
      network: opts.network,
      exchangeUrl: opts.exchangeUrl,
    });
    if (!config.capacityExchangeUrl) {
      throw new Error(
        "CES exchange URL required. Set --exchange-url or CAPACITY_EXCHANGE_URL env var.",
      );
    }
    await runIncrement(config, {
      currency: opts.currency,
      autoConfirm: opts.autoConfirm,
      contractAddress: opts.contractAddress,
      mnemonic: opts.mnemonic,
    });
  } catch (err) {
    handleError(err);
  }
});

const balancesCmd = new Command("balances").description(
  "Display wallet balances (DUST, NIGHT, tokens)",
);

addCommonOptions(balancesCmd);

balancesCmd.action(async (opts) => {
  setJsonMode(!!opts.json);
  try {
    const config = resolveCliConfig({ network: opts.network });
    await runBalances(config, { mnemonic: opts.mnemonic });
  } catch (err) {
    handleError(err);
  }
});

const pricesCmd = new Command("prices")
  .description("Fetch and display current CES exchange prices")
  .option(
    "--exchange-url <url>",
    "CES exchange server URL (default: from CES_URL env)",
  )
  .option(
    "--specks <amount>",
    "DUST amount in specks to price (prompted if not provided)",
  );

addCommonOptions(pricesCmd);

pricesCmd.action(async (opts) => {
  setJsonMode(!!opts.json);
  try {
    const config = resolveCesOnlyConfig({
      network: opts.network,
      exchangeUrl: opts.exchangeUrl,
    });
    await runPrices(config, { specks: opts.specks });
  } catch (err) {
    handleError(err);
  }
});

program.addCommand(incrementCmd);
program.addCommand(balancesCmd);
program.addCommand(pricesCmd);

function handleError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  if (isJsonMode()) {
    printJsonError(message);
  } else {
    console.error(`\nError: ${message}`);
  }
  process.exit(1);
}

program.parseAsync();
