import { AppContext, buildProviders } from '@capacity-exchange/midnight-node';
import { toTxResult, type TxResult } from '@capacity-exchange/midnight-core';
import { createLogger } from '@capacity-exchange/midnight-node';
import { VaultContract } from '../core/contract.js';
import { submitWithdrawalTx } from '../core/request-withdrawal.js';

const logger = createLogger(import.meta);

export interface RequestWithdrawalParams {
  contractAddress: string;
  amount: bigint;
  domainSep: string;
  cardanoAddress: string;
}

export async function requestWithdrawal(ctx: AppContext, params: RequestWithdrawalParams): Promise<TxResult> {
  const { contractAddress, amount, domainSep, cardanoAddress } = params;
  logger.info(`Requesting withdrawal of ${amount} from ${contractAddress}...`);

  const providers = buildProviders<VaultContract>(ctx, './vault/out');

  const result = await submitWithdrawalTx({
    providers,
    contractAddress,
    amount,
    domainSep,
    cardanoAddress,
  });

  logger.info(`Withdrawal request submitted: ${result.txId}`);
  return toTxResult(contractAddress, result);
}
