import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { SucceedEntirely } from '@midnight-ntwrk/midnight-js-types';
import { createUnprovenCallTx, submitTx } from '@midnight-ntwrk/midnight-js-contracts';
import { uint8ArrayToHex } from '@capacity-exchange/midnight-core';
import { CompiledVaultContract } from './contract.js';
import { createPrivateState } from './witnesses.js';
import { buildWithdrawalArgs } from './withdrawal-args.js';

export interface SubmitWithdrawalTxParams {
  providers: MidnightProviders<'requestWithdrawal'>;
  contractAddress: string;
  amount: bigint;
  domainSep: string;
  cardanoAddress: string;
  datumHash?: string;
}

/**
 * Submit a vault withdrawal transaction. Platform-agnostic — works with any
 * MidnightProviders (browser via ConnectedAPI or Node via AppContext).
 *
 * The caller is responsible for building the providers; this function handles
 * seeding dummy private state, building withdrawal args, and creating + submitting the tx.
 */
export async function submitWithdrawalTx(params: SubmitWithdrawalTxParams) {
  const { providers, contractAddress, amount, domainSep, cardanoAddress, datumHash } = params;

  // Seed dummy private state — requestWithdrawal doesn't use witnesses, but
  // createUnprovenCallTx requires privateStateId for any Contract.Any.
  const randomId = new Uint8Array(32);
  crypto.getRandomValues(randomId);
  const privateStateId = uint8ArrayToHex(randomId);
  await providers.privateStateProvider.set(
    privateStateId,
    createPrivateState([
      { x: 0n, y: 0n },
      { x: 0n, y: 0n },
      { x: 0n, y: 0n },
    ])
  );

  const coinNonce = new Uint8Array(32);
  crypto.getRandomValues(coinNonce);
  const { coin, domainSepBytes, cardanoAddressBytes, maybeDatumHash } = buildWithdrawalArgs({
    contractAddress,
    amount,
    domainSep,
    cardanoAddress,
    coinNonce,
    datumHash,
  });

  const callTxData = await createUnprovenCallTx(providers, {
    contractAddress,
    compiledContract: CompiledVaultContract,
    circuitId: 'requestWithdrawal' as const,
    privateStateId,
    args: [coin, domainSepBytes, cardanoAddressBytes, maybeDatumHash],
  });

  const result = await submitTx(providers, {
    unprovenTx: callTxData.private.unprovenTx,
    circuitId: 'requestWithdrawal' as const,
  });

  if (result.status !== SucceedEntirely) {
    throw new Error(`Withdrawal transaction failed with status: ${result.status}`);
  }

  return result;
}
