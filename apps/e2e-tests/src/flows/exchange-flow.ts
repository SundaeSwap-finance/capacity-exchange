import type { AppContext } from '@capacity-exchange/midnight-node';
import { buildProviders, getAppConfigById, createLogger } from '@capacity-exchange/midnight-node';
import { capacityExchangeWalletProvider, type ExchangePrice } from '@sundaeswap/capacity-exchange-providers';
import { uint8ArrayToHex } from '@sundaeswap/capacity-exchange-core';
import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { Transaction, SignatureEnabled, type Proof, type PreBinding } from '@midnight-ntwrk/ledger-v8';
import { CompiledContract } from '@midnight-ntwrk/compact-js';
import { CompiledCounterContract, type CounterContract } from '@capacity-exchange/demo-contracts/counter';

const logger = createLogger(import.meta);
const BALANCE_TTL_MS = 5 * 60 * 1000;

export interface ExchangeFlowResult {
  status: string;
}

export async function runExchangeFlow(
  ctx: AppContext,
  networkId: string,
  counterAddress: string,
  cesUrl: string,
  derivedTokenColor: string
): Promise<ExchangeFlowResult> {
  logger.info('Starting exchange flow: increment counter via CES');

  const cesProvider = createExchangeProvider(ctx, networkId, cesUrl, derivedTokenColor);

  const providers = {
    ...buildProviders<CounterContract>(ctx, CompiledContract.getCompiledAssetsPath(CompiledCounterContract)),
    walletProvider: cesProvider,
  };

  await findDeployedContract(providers, {
    compiledContract: CompiledCounterContract,
    contractAddress: counterAddress,
  });

  logger.info('Submitting counter increment via CES exchange flow');
  const result = await submitCallTx(providers, {
    compiledContract: CompiledCounterContract,
    contractAddress: counterAddress,
    circuitId: 'increment' as const,
  });

  logger.info({ status: result.public.status }, 'Exchange flow completed');
  return { status: result.public.status };
}

function createExchangeProvider(ctx: AppContext, networkId: string, cesUrl: string, derivedTokenColor: string) {
  const appConfig = getAppConfigById(networkId);

  return capacityExchangeWalletProvider({
    networkId,
    coinPublicKey: ctx.walletContext.walletProvider.getCoinPublicKey(),
    encryptionPublicKey: ctx.walletContext.walletProvider.getEncryptionPublicKey(),
    balanceTransaction: createBalanceCallback(ctx),
    indexerUrl: appConfig.endpoints.indexerHttpUrl,
    additionalCapacityExchangeUrls: [cesUrl],
    promptForCurrency: (prices) => selectCurrency(prices, derivedTokenColor),
    confirmOffer: autoConfirmOffer,
  });
}

function createBalanceCallback(ctx: AppContext) {
  return async (txHex: string) => {
    const tx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
      'signature',
      'proof',
      'pre-binding',
      Buffer.from(txHex, 'hex')
    );
    const ttl = new Date(Date.now() + BALANCE_TTL_MS);
    const recipe = await ctx.walletContext.walletFacade.balanceUnboundTransaction(
      tx,
      {
        shieldedSecretKeys: ctx.walletContext.keys.shieldedSecretKeys,
        dustSecretKey: ctx.walletContext.keys.dustSecretKey,
      },
      { ttl, tokenKindsToBalance: ['shielded'] }
    );
    const balancedTx = await ctx.walletContext.walletFacade.finalizeRecipe(recipe);
    return { tx: uint8ArrayToHex(balancedTx.serialize()) };
  };
}

async function selectCurrency(prices: ExchangePrice[], derivedTokenColor: string) {
  const match = prices.find((p) => p.price.currency.rawId === derivedTokenColor);
  if (!match) {
    const available = prices.map((p) => p.price.currency.rawId).join(', ');
    throw new Error(`CES does not offer currency ${derivedTokenColor}. Available: ${available}`);
  }
  return { status: 'selected' as const, exchangePrice: match };
}

async function autoConfirmOffer() {
  return { status: 'confirmed' as const };
}
