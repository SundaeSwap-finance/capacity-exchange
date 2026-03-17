import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { submitWithdrawalTx } from '@capacity-exchange/bridge-contracts/vault/core/request-withdrawal.js';
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
  const config = getNetworkConfig();
  const providers = buildVaultProviders<'requestWithdrawal'>(
    connectedAPI,
    { shieldedAddress, shieldedCoinPublicKey, shieldedEncryptionPublicKey },
    {
      indexerUrl: config.indexerUrl,
      indexerWsUrl: config.indexerWsUrl,
      proofServerUrl: config.proofServerUrl,
    }
  );

  const result = await submitWithdrawalTx({
    providers,
    contractAddress,
    amount,
    domainSep,
    cardanoAddress,
    datumHash,
  });

  return { txHash: result.txId };
}
