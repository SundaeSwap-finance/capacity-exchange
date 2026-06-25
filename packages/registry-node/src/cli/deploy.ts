import { program } from 'commander';
import { parsePositiveNumber } from '@sundaeswap/capacity-exchange-core';
import { runCli, withAppContextFromEnv, requireEnvVar, resolveEnv } from '@sundaeswap/capacity-exchange-nodejs';
import { deploy, DeployOutput } from '../deploy.js';

const DEFAULT_PERIOD_DAYS: Record<string, number> = {
  mainnet: 30,
  preprod: 0.5,
  preview: 0.5,
};

function main(): Promise<DeployOutput> {
  program
    .name('registry:deploy')
    .description('[Internal] Deploys a new registry contract')
    .argument('<collateral>', 'required collateral for each offer')
    .argument(
      '[registrationPeriod]',
      'max registration period in days (default: 30 for mainnet, 0.5 for preview/preprod)'
    )
    .parse();

  const networkId = requireEnvVar(resolveEnv(), 'NETWORK_ID');
  const [collateral, registrationPeriod] = program.processedArgs;

  const defaultDays = DEFAULT_PERIOD_DAYS[networkId] ?? 0.5;
  const days = registrationPeriod ? parsePositiveNumber('registrationPeriod', registrationPeriod) : defaultDays;

  const args = {
    requiredCollateral: BigInt(collateral),
    maxPeriod: BigInt(Math.floor(days * 24 * 60 * 60)),
  };
  console.log(
    `set arguments: ${JSON.stringify(args, (_, value) => (typeof value === 'bigint' ? value.toString() : value))}`
  );

  return withAppContextFromEnv(networkId, (ctx) => deploy(ctx, args));
}

runCli(main);
