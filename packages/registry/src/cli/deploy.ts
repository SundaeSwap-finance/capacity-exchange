import * as fs from 'fs';
import { program } from 'commander';
import { runCli, withAppContext, requireNetworkId } from '@capacity-exchange/midnight-node';
import { deploy, DeployOutput } from '../deploy.js';

function main(): Promise<DeployOutput> {
  program
    .name('registry:deploy')
    .description('[Internal] Deploys a new registry contract with multisig public keys')
    .argument('<secretKeyFile>', 'file with the secret key for the registry contract, as a hex string')
    .argument('<collateral>', 'required collateral for each offer')
    .argument('[validityInterval]', 'max validity interval for offers, in seconds (default: 30 days)')
    .parse();

  const networkId = requireNetworkId();
  const [secretKeyFile, collateral, validityInterval] = program.args;

  const secretKey = Buffer.from(fs.readFileSync(secretKeyFile, 'utf-8').trim(), 'hex');
  const args = {
    requiredCollateral: BigInt(collateral),
    maxValidityInterval: BigInt(validityInterval ?? 30 * 24 * 60 * 60),
  };

  return withAppContext(networkId, (ctx) => deploy(ctx, secretKey, args));
}

runCli(main);