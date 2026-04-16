import { program } from 'commander';
import { runCli, withAppContext, requireNetworkId } from '@capacity-exchange/midnight-node';
import { deploy, DeployOutput } from '../deploy.js';

function main(): Promise<DeployOutput> {
  program
    .name('registry:deploy')
    .description('[Internal] Deploys a new registry contract')
    .argument('<collateral>', 'required collateral for each offer')
    .argument('[registrationPeriod]', 'max registration period in days (default: 30)', '30')
    .parse();

  const networkId = requireNetworkId();
  const [collateral, registrationPeriod] = program.args;

  const days = Number(registrationPeriod);
  if (!Number.isFinite(days) || days <= 0) {
    throw new Error(`Invalid registrationPeriod: "${registrationPeriod}". Expected a positive number of days.`);
  }

  const args = {
    requiredCollateral: BigInt(collateral),
    maxPeriod: BigInt(Math.floor(days * 24 * 60 * 60)),
  };
  console.log("ARGUMENTS: ", args);


  return withAppContext(networkId, (ctx) => deploy(ctx, args));
}

runCli(main);
