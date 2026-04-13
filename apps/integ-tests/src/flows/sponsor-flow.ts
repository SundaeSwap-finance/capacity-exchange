import * as crypto from 'crypto';
import type { AppContext } from '@capacity-exchange/midnight-node';
import { buildProviders, createLogger } from '@capacity-exchange/midnight-node';
import { sponsoredTransactionsWalletProvider } from '@sundaeswap/capacity-exchange-providers';
import { findDeployedContract, createUnprovenCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { SucceedEntirely } from '@midnight-ntwrk/midnight-js-types';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { CompiledTokenMintContract, type TokenMintContract } from '@capacity-exchange/demo-contracts/token-mint';
import { createPrivateState } from '@capacity-exchange/demo-contracts/token-mint/witnesses';

const logger = createLogger(import.meta);

export interface SponsorFlowResult {
  txId: string;
  status: string;
}

export async function runSponsorFlow(
  ctx: AppContext,
  tokenMintAddress: string,
  cesUrl: string,
  mintAmount = 1_000_000n
): Promise<SponsorFlowResult> {
  logger.info('Starting sponsor flow: mint tokens via CES sponsorship');

  const sponsoredProvider = createSponsoredProvider(ctx, cesUrl);

  const providers = {
    ...buildProviders<TokenMintContract>(ctx, CompiledContract.getCompiledAssetsPath(CompiledTokenMintContract)),
    walletProvider: sponsoredProvider,
  };

  const { privateStateId, initialPrivateState } = generatePrivateState();

  await findDeployedContract(providers, {
    compiledContract: CompiledTokenMintContract,
    contractAddress: tokenMintAddress,
    privateStateId,
    initialPrivateState,
  });

  const balancedTx = await proveAndSponsor(providers, tokenMintAddress, privateStateId, mintAmount);

  logger.info('Submitting sponsored transaction');
  const txId = await providers.midnightProvider.submitTx(balancedTx);

  logger.info({ txId }, 'Waiting for confirmation');
  const result = await providers.publicDataProvider.watchForTxData(txId);

  if (result.status !== SucceedEntirely) {
    throw new Error(`Sponsored mint failed with status: ${result.status}`);
  }

  logger.info('Sponsor flow completed successfully');
  return { txId, status: result.status };
}

function createSponsoredProvider(ctx: AppContext, cesUrl: string) {
  return sponsoredTransactionsWalletProvider({
    coinPublicKey: ctx.walletContext.walletProvider.getCoinPublicKey(),
    encryptionPublicKey: ctx.walletContext.walletProvider.getEncryptionPublicKey(),
    capacityExchangeUrl: cesUrl,
  });
}

function generatePrivateState() {
  return {
    privateStateId: crypto.randomBytes(32).toString('hex'),
    initialPrivateState: createPrivateState(crypto.randomBytes(32), crypto.randomBytes(32)),
  };
}

async function proveAndSponsor(
  providers: ReturnType<typeof buildProviders<TokenMintContract>> & {
    walletProvider: ReturnType<typeof sponsoredTransactionsWalletProvider>;
  },
  contractAddress: string,
  privateStateId: string,
  mintAmount: bigint
) {
  logger.info('Building and proving mint transaction');
  const callTxData = await createUnprovenCallTx(providers, {
    compiledContract: CompiledTokenMintContract,
    contractAddress,
    circuitId: 'mint_test_tokens' as const,
    args: [mintAmount] as [bigint],
    privateStateId,
  });

  const provenTx = await providers.proofProvider.proveTx(callTxData.private.unprovenTx);

  logger.info('Requesting CES sponsorship');
  return providers.walletProvider.balanceTx(provenTx);
}
