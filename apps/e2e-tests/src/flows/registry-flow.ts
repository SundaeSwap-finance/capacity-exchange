import * as crypto from 'crypto';
import * as path from 'path';
import type { AppContext } from '@capacity-exchange/midnight-node';
import { buildProviders, getAppConfigById, createLogger } from '@capacity-exchange/midnight-node';
import { capacityExchangeWalletProvider, type ExchangePrice } from '@sundaeswap/capacity-exchange-providers';
import { uint8ArrayToHex, DEFAULT_TTL_MS } from '@sundaeswap/capacity-exchange-core';
import { submitCallTx, findDeployedContract } from '@midnight-ntwrk/midnight-js-contracts';
import { Transaction, SignatureEnabled, type Proof, type PreBinding } from '@midnight-ntwrk/ledger-v8';
import type { UnboundTransactionRecipe } from '@midnight-ntwrk/wallet-sdk-facade';
import {
  CompiledRegistryContract,
  createPrivateState,
  entryToContract,
  type RegistryContract,
  type RegistryEntry,
} from '@capacity-exchange/registry';

const logger = createLogger(import.meta);

export interface RegistryFlowResult {
  status: string;
}

/**
 * Registers a server in the on-chain registry via CES exchange flow.
 *
 * This proves whether the SDK can handle contracts that use receiveUnshielded —
 * the registry requires unshielded NIGHT collateral.
 */
export async function runRegistryFlow(
  ctx: AppContext,
  networkId: string,
  registryAddress: string,
  cesUrl: string,
  derivedTokenColor: string
): Promise<RegistryFlowResult> {
  logger.info('Starting registry flow: register server via CES exchange');

  const contractOutDir = path.resolve(require.resolve('@capacity-exchange/registry'), '../../contract/out');
  const privateStateId = crypto.randomBytes(32).toString('hex');
  const secretKey = crypto.randomBytes(64);

  const cesProvider = createExchangeProvider(ctx, networkId, cesUrl, derivedTokenColor);

  const providers = {
    ...buildProviders<RegistryContract>(ctx, contractOutDir),
    walletProvider: cesProvider,
  };

  await findDeployedContract(providers, {
    compiledContract: CompiledRegistryContract,
    contractAddress: registryAddress,
    privateStateId,
    initialPrivateState: createPrivateState(secretKey),
  });

  const entry: RegistryEntry = {
    ip: { kind: 'ipv4', address: '127.0.0.1' },
    port: 3000,
    validTo: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };

  logger.info('Submitting registerServer via CES exchange flow');
  const result = await submitCallTx(providers, {
    compiledContract: CompiledRegistryContract,
    contractAddress: registryAddress,
    circuitId: 'registerServer' as const,
    privateStateId,
    args: [entryToContract(entry)],
  });

  logger.info({ status: result.public.status }, 'Registry flow completed');
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

/**
 * Balances shielded + unshielded (skipping dust, which CES provides).
 * Signs only baseTransaction because signRecipe errors on the balancingTransaction
 * which has no unshielded segments.
 */
function createBalanceCallback(ctx: AppContext) {
  return async (txHex: string) => {
    const tx = Transaction.deserialize<SignatureEnabled, Proof, PreBinding>(
      'signature',
      'proof',
      'pre-binding',
      Buffer.from(txHex, 'hex')
    );
    const { walletFacade, keys } = ctx.walletContext;
    const ttl = new Date(Date.now() + DEFAULT_TTL_MS);

    const recipe = await walletFacade.balanceUnboundTransaction(
      tx,
      { shieldedSecretKeys: keys.shieldedSecretKeys, dustSecretKey: keys.dustSecretKey },
      { ttl, tokenKindsToBalance: ['shielded', 'unshielded'] }
    );

    const { baseTransaction, balancingTransaction } = recipe as UnboundTransactionRecipe;
    const signedBaseTx = await walletFacade.signUnboundTransaction(
      baseTransaction,
      (payload: Uint8Array) => keys.unshieldedKeystore.signData(payload)
    );

    const signedRecipe: UnboundTransactionRecipe = {
      type: 'UNBOUND_TRANSACTION',
      baseTransaction: signedBaseTx,
      balancingTransaction,
    };
    const balancedTx = await walletFacade.finalizeRecipe(signedRecipe);
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
