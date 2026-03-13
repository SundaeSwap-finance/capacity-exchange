import { program } from 'commander';
import { runCli, withAppContext, requireNetworkId } from '@capacity-exchange/midnight-node';
import { listWithdrawalRequests, WithdrawalEntry } from '../node/list-withdrawal-requests.js';

function main(): Promise<WithdrawalEntry[]> {
  program
    .name('vault:list-withdrawal-requests')
    .description('[Internal] Lists pending withdrawal requests from a deployed vault contract')
    .argument('<contractAddress>', 'Address of the deployed vault contract')
    .parse();

  const networkId = requireNetworkId();
  const [contractAddress] = program.args;

  return withAppContext(networkId, (ctx) => listWithdrawalRequests(ctx, contractAddress));
}

runCli(main, { pretty: true });
