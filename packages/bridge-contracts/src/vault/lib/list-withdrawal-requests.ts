import { AppContext, buildProviders } from '@capacity-exchange/midnight-node';
import { Vault, VaultContract } from './contract.js';
import { createLogger } from '@capacity-exchange/midnight-node';

const logger = createLogger(import.meta);

export interface WithdrawalEntry {
  key: string;
  amount: string;
  address: string;
  domainSep: string;
  datumHash: string | null;
}

export async function listWithdrawalRequests(ctx: AppContext, contractAddress: string): Promise<WithdrawalEntry[]> {
  logger.info(`Querying withdrawal requests from ${contractAddress}...`);

  const providers = buildProviders<VaultContract>(ctx, './vault/out');
  const contractState = await providers.publicDataProvider.queryContractState(contractAddress);
  if (!contractState) {
    throw new Error(`Contract not found at address: ${contractAddress}`);
  }

  const ledgerState = Vault.ledger(contractState.data);
  const entries: WithdrawalEntry[] = [];
  for (const [key, withdrawal] of ledgerState.withdrawals) {
    entries.push({
      key: Buffer.from(key).toString('hex'),
      amount: withdrawal.amount.toString(),
      address: Buffer.from(withdrawal.address).toString('hex'),
      domainSep: Buffer.from(withdrawal.domainSep).toString('hex'),
      datumHash: withdrawal.datumHash.is_some ? Buffer.from(withdrawal.datumHash.value).toString('hex') : null,
    });
  }

  logger.info(`Found ${entries.length} withdrawal request(s)`);
  return entries;
}
