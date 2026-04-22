import { program } from 'commander';
import { runCli, withAppContextFromEnv, requireNetworkId } from '@sundaeswap/capacity-exchange-nodejs';
import { deploy, DeployOutput } from '../deploy.js';

function main(): Promise<DeployOutput> {
  program
    .name('registry:deploy')
    .description('[Internal] Deploys a new registry contract')
    .argument('<collateral>', 'required collateral for each offer')
    .argument('[registrationPeriod]', 'max registration period in days (default: 30)', '30')
    .parse();

  const networkId = requireNetworkId();
  const [collateral, registrationPeriod] = program.processedArgs;

  const days = Number(registrationPeriod);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`Invalid registrationPeriod: "${registrationPeriod}". Expected a positive number of days.`);
  }

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
