import * as crypto from 'crypto';
import { AppContext, buildProviders, submitStatefulCallTxDirect } from '@capacity-exchange/midnight-node';
import { toTxResult, type TxResult } from '@capacity-exchange/midnight-core';
import { createLogger } from '@capacity-exchange/midnight-node';
import { CompiledVaultContract, VaultContract } from '../lib/contract.js';
import { createPrivateState } from '../lib/witnesses.js';
import { buildWithdrawalArgs } from '../lib/withdrawal-args.js';

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

  // Dummy private state — requestWithdrawal doesn't use witnesses, but
  // createUnprovenCallTx requires privateStateId for any Contract.Any (no
  // per-circuit opt-out). Removable once we upgrade to midnight-js >=3.2.0
  // (#535) and switch to createCircuitCallTxInterface (accepts undefined).
  const privateStateId = crypto.randomBytes(32).toString('hex');
  await providers.privateStateProvider.set(
    privateStateId,
    createPrivateState([
      { x: 0n, y: 0n },
      { x: 0n, y: 0n },
      { x: 0n, y: 0n },
    ])
  );

  const { coin, domainSepBytes, cardanoAddressBytes, maybeDatumHash } = buildWithdrawalArgs({
    contractAddress,
    amount,
    domainSep,
    cardanoAddress,
    coinNonce: crypto.randomBytes(32),
  });

  const result = await submitStatefulCallTxDirect<VaultContract, 'requestWithdrawal'>(providers, {
    contractAddress,
    compiledContract: CompiledVaultContract,
    circuitId: 'requestWithdrawal',
    privateStateId,
    args: [coin, domainSepBytes, cardanoAddressBytes, maybeDatumHash],
  });

  logger.info(`Withdrawal request submitted in block ${result.public.blockHeight}`);
  return toTxResult(contractAddress, result.public);
}
