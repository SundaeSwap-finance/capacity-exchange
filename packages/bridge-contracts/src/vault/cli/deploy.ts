import { program } from 'commander';
import { runCli, withAppContext, requireNetworkId } from '@capacity-exchange/midnight-node';
import { deploy, DeployOutput } from '../lib/deploy.js';
import { loadKeyPairs } from '../lib/schnorr.js';

function main(): Promise<DeployOutput> {
  program
    .name('vault:deploy')
    .description('Deploys a new vault contract with multisig public keys')
    .argument('<keysFile>', 'JSON file with key pairs from vault:generate-keys')
    .parse();

  const networkId = requireNetworkId();
  const [keysFile] = program.args;
  const publicKeys = loadKeyPairs(keysFile).map((kp) => kp.publicKey);

  return withAppContext(networkId, (ctx) => deploy(ctx, { publicKeys }));
}

runCli(main);
