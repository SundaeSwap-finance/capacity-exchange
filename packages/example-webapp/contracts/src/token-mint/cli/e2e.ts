import { program } from 'commander';
import { runCli, withAppContext } from '../../lib/cli.js';
import { deploy, mint, verify, DeployOutput, MintOutput, VerifyOutput } from '../lib/operations.js';

interface E2EOutput {
  deploy: DeployOutput;
  mint: MintOutput;
  verify: VerifyOutput;
}

function main(): Promise<E2EOutput> {
  program
    .name('token-mint:e2e')
    .description('Deploys a token mint contract, mints tokens, and verifies the balance')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .argument('<amount>', 'Number of tokens to mint')
    .argument('[tokenColor]', '32-byte hex string for the token color (random if not provided)')
    .parse();

  const [networkId, amountStr, tokenColor] = program.args;
  const amount = BigInt(amountStr);

  return withAppContext(networkId, './token-mint/out', async (ctx) => {
    const deployResult = await deploy(ctx, tokenColor);
    const mintResult = await mint(ctx, deployResult.contractAddress, deployResult.privateStateId, amount);
    const verifyResult = await verify(ctx, deployResult.contractAddress, deployResult.tokenColor);

    return {
      deploy: deployResult,
      mint: mintResult,
      verify: verifyResult,
    };
  });
}

runCli(main, { pretty: true });
