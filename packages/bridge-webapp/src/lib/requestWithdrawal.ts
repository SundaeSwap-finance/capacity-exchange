// TODO: Extract shared requestWithdrawal logic into bridge-contracts/vault/core
// to eliminate duplication with bridge-contracts/vault/node/request-withdrawal.ts
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import type { MidnightProviders } from '@midnight-ntwrk/midnight-js-types';
import { createUnprovenCallTx, submitTx } from '@midnight-ntwrk/midnight-js-contracts';
import { uint8ArrayToHex } from '@capacity-exchange/midnight-core';
import { buildWithdrawalArgs } from '@capacity-exchange/bridge-contracts/vault/core/withdrawal-args.js';
import { CompiledVaultContract } from '@capacity-exchange/bridge-contracts/vault/core/contract.js';
import { createPrivateState } from '@capacity-exchange/bridge-contracts/vault/core/witnesses.js';
import { buildVaultProviders } from './vaultProviders';
import { getNetworkConfig, getVaultConfig } from './config';

export interface BrowserWithdrawalParams {
  connectedAPI: ConnectedAPI;
  shieldedAddress: string;
  shieldedCoinPublicKey: string;
  shieldedEncryptionPublicKey: string;
  amount: bigint;
  cardanoAddress: string;
  domainSep: string;
  datumHash?: string;
}

export interface WithdrawalResult {
  txHash: string;
}

function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function buildProviders(
  connectedAPI: ConnectedAPI,
  shieldedAddress: string,
  shieldedCoinPublicKey: string,
  shieldedEncryptionPublicKey: string
) {
  const config = getNetworkConfig();
  return buildVaultProviders<'requestWithdrawal'>(
    connectedAPI,
    { shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey },
    {
      indexerUrl: config.indexerUrl,
      indexerWsUrl: config.indexerWsUrl,
      proofServerUrl: config.proofServerUrl,
    }
  );
}

/** Seed a dummy private state — requestWithdrawal doesn't use witnesses, but createUnprovenCallTx requires one. */
async function seedDummyPrivateState(providers: MidnightProviders<'requestWithdrawal'>): Promise<string> {
  const privateStateId = uint8ArrayToHex(randomBytes(32));
  await providers.privateStateProvider.set(
    privateStateId,
    createPrivateState([
      { x: 0n, y: 0n },
      { x: 0n, y: 0n },
      { x: 0n, y: 0n },
    ])
  );
  return privateStateId;
}

async function createAndSubmitTx(
  providers: MidnightProviders<'requestWithdrawal'>,
  contractAddress: string,
  privateStateId: string,
  args: Parameters<typeof buildWithdrawalArgs>[0]
): Promise<WithdrawalResult> {
  const { coin, domainSepBytes, cardanoAddressBytes, maybeDatumHash } = buildWithdrawalArgs(args);

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

  return { txHash: result.txId };
}

/** Submit a vault withdrawal transaction from the browser via the connected Midnight wallet. */
export async function requestWithdrawal(params: BrowserWithdrawalParams): Promise<WithdrawalResult> {
  const {
    connectedAPI,
    shieldedAddress,
    shieldedCoinPublicKey,
    shieldedEncryptionPublicKey,
    amount,
    cardanoAddress,
    domainSep,
    datumHash,
  } = params;

  const { contractAddress } = getVaultConfig();
  const providers = buildProviders(connectedAPI, shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey);
  const privateStateId = await seedDummyPrivateState(providers);

  return createAndSubmitTx(providers, contractAddress, privateStateId, {
    contractAddress,
    amount,
    domainSep,
    cardanoAddress,
    coinNonce: randomBytes(32),
    datumHash,
  });
}
