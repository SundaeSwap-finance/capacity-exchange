import { program } from 'commander';
import { runCli, withAppContext } from '@capacity-exchange/midnight-node';
import { type TxResult } from '@capacity-exchange/midnight-core';
import { deploy, increment, query, DeployOutput, QueryOutput } from '../lib/operations.js';

interface E2EOutput {
  deploy: DeployOutput;
  increments: TxResult[];
  query: QueryOutput;
}

function main(): Promise<E2EOutput> {
  program
    .name('counter:e2e')
    .description('Deploys a counter contract, increments it, and queries the final value')
    .argument('<networkId>', 'Network ID (e.g., undeployed, preview)')
    .argument('[incrementCount]', 'Number of times to increment the counter', '1')
    .parse();

  const [networkId, incrementCountArg] = program.args;
  const incrementCount = incrementCountArg ? parseInt(incrementCountArg, 10) : 1;

  if (isNaN(incrementCount) || incrementCount < 1) {
    throw new Error('incrementCount must be a positive integer');
  }

  return withAppContext(networkId, async (ctx) => {
    const deployResult = await deploy(ctx);

    const incrementResults: TxResult[] = [];
    for (let i = 0; i < incrementCount; i++) {
      const incrementResult = await increment(ctx, deployResult.contractAddress);
      incrementResults.push(incrementResult);
    }

    const queryResult = await query(ctx, deployResult.contractAddress);

    return {
      deploy: deployResult,
      increments: incrementResults,
      query: queryResult,
    };
  });
}

runCli(main, { pretty: true });
