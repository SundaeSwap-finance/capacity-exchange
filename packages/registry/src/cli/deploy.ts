import { program } from 'commander';
import { runCli, withAppContext, requireNetworkId } from '@capacity-exchange/midnight-node';
import { deploy, DeployOutput } from '../deploy.js';

function main(): Promise<DeployOutput> {
  program
    .name('registry:deploy')
    .description('[Internal] Deploys a new registry contract with multisig public keys')
    .argument('<collateral>', 'required collateral for each offer')
    .argument('[validityInterval]', 'max validity interval for offers, in seconds (default: 30 days)')
    .parse();

  const networkId = requireNetworkId();
  const [collateral, validityInterval] = program.args;

  const args = {
    requiredCollateral: BigInt(collateral),
    maxValidityInterval: BigInt(validityInterval ?? 30 * 24 * 60 * 60),
  };

  return withAppContext(networkId, (ctx) => deploy(ctx, args));
}

runCli(main);
