import { program } from 'commander';
import { runCli, withAppContext, requireNetworkId } from '@capacity-exchange/midnight-node';
import { type TxResult } from '@capacity-exchange/midnight-core';
import type { AppContext } from '@capacity-exchange/midnight-node';
import { deploy, DeployOutput } from '../lib/deploy.js';
import { deposit } from '../lib/deposit.js';
import { requestWithdrawal } from '../lib/request-withdrawal.js';
import { listWithdrawalRequests, WithdrawalEntry } from '../lib/list-withdrawal-requests.js';
import { loadKeyPairs, type KeyPair } from '../lib/schnorr.js';

interface E2EParams {
  keyPairs: KeyPair[];
  amount: bigint;
  domainSep: string;
  cardanoAddress: string;
}

interface E2EOutput {
  deploy: DeployOutput;
  deposit: TxResult;
  requestWithdrawal: TxResult;
  withdrawalRequests: WithdrawalEntry[];
}

function parseArgs(): E2EParams {
  program
    .name('vault:e2e')
    .description('[Internal] Deploys a vault, deposits tokens, and requests a withdrawal')
    .argument('<keysFile>', 'JSON file with key pairs from vault:generate-keys')
    .argument('<amount>', 'Amount to deposit and withdraw (in atomic units)')
    .argument('<domainSep>', 'Domain separator (64-char hex)')
    .argument('<cardanoAddress>', 'Cardano address to withdraw to (hex)')
    .parse();

  const [keysFile, amountStr, domainSep, cardanoAddress] = program.args;

  return {
    keyPairs: loadKeyPairs(keysFile),
    amount: BigInt(amountStr),
    domainSep,
    cardanoAddress,
  };
}

async function runE2E(ctx: AppContext, params: E2EParams): Promise<E2EOutput> {
  const { keyPairs, amount, domainSep, cardanoAddress } = params;
  const publicKeys = keyPairs.map((kp) => kp.publicKey);

  const deployResult = await deploy(ctx, { publicKeys });

  const depositResult = await deposit(ctx, {
    contractAddress: deployResult.contractAddress,
    keyPairs,
    domainSep,
    amount,
  });

  const withdrawalResult = await requestWithdrawal(ctx, {
    contractAddress: deployResult.contractAddress,
    amount,
    domainSep,
    cardanoAddress,
  });

  const withdrawalRequests = await listWithdrawalRequests(ctx, deployResult.contractAddress);

  return {
    deploy: deployResult,
    deposit: depositResult,
    requestWithdrawal: withdrawalResult,
    withdrawalRequests,
  };
}

function main(): Promise<E2EOutput> {
  const networkId = requireNetworkId();
  const params = parseArgs();
  return withAppContext(networkId, (ctx) => runE2E(ctx, params));
}

runCli(main, { pretty: true });
