import * as crypto from 'crypto';
import { deployContract, findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';
import { AppContext } from '../../lib/app-context.js';
import { getContractProviders } from '../../lib/providers/contract.js';
import { createTokenMintContract, TokenMintContract } from './contract.js';
import { deriveTokenColor } from './token-color.js';
import { createPrivateState } from './witnesses.js';
import { deriveWalletKeys } from '../../lib/wallet/keys.js';
import { getNetworkConfig } from '../../lib/config/env.js';

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
  tokenColor: string;
  privateStateId: string;
}

export function generateTokenColor(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function deploy(ctx: AppContext, tokenColor?: string): Promise<DeployOutput> {
  const resolvedTokenColor = tokenColor ?? generateTokenColor();
  console.error(`[deploy] Deploying token-mint contract with color ${resolvedTokenColor.slice(0, 8)}...`);

  const providers = getContractProviders<TokenMintContract>(ctx);
  const contract = createTokenMintContract();
  const initialNonce = crypto.randomBytes(32);

  const privateStateId = crypto.randomBytes(32).toString('hex');
  console.error(`[deploy] Generated private state ID: ${privateStateId}`);
  const initialPrivateState = createPrivateState(crypto.randomBytes(32));
  console.error('[deploy] Created initial private state');

  console.error('[deploy] Calling deployContract...');
  const deployed = await deployContract(providers, {
    contract,
    args: [Buffer.from(resolvedTokenColor, 'hex'), initialNonce],
    privateStateId,
    initialPrivateState,
  });

  console.error(`[deploy] Token-mint deployed at ${deployed.deployTxData.public.contractAddress}`);
  return {
    contractAddress: deployed.deployTxData.public.contractAddress,
    txHash: deployed.deployTxData.public.txHash,
    tokenColor: resolvedTokenColor,
    privateStateId,
  };
}

export interface MintOutput {
  txHash: string;
  contractAddress: string;
  amount: string;
  derivedTokenColor: string;
}

export async function mint(
  ctx: AppContext,
  contractAddress: string,
  privateStateId: string,
  amount: bigint
): Promise<MintOutput> {
  console.error(`[mint] Minting ${amount} tokens at ${contractAddress}...`);
  console.error(`[mint] Private state ID: ${privateStateId}`);
  const providers = getContractProviders<TokenMintContract>(ctx);
  const contract = createTokenMintContract();

  console.error('[mint] Looking up deployed contract...');
  await findDeployedContract(providers, {
    contract,
    contractAddress,
    privateStateId,
  });
  console.error('[mint] Found deployed contract');

  console.error('Submitting mint transaction...');
  const result = await submitCallTx(providers, {
    contract,
    contractAddress,
    circuitId: 'mint_test_tokens',
    args: [amount],
    privateStateId,
  });

  if (!result.private.result) {
    throw new Error('Mint transaction succeeded but no result returned');
  }

  const derivedTokenColor = Buffer.from(result.private.result.color).toString('hex');
  console.error(`Mint confirmed, derived color: ${derivedTokenColor.slice(0, 8)}...`);

  return {
    txHash: result.public.txHash,
    contractAddress,
    amount: amount.toString(),
    derivedTokenColor,
  };
}

export interface VerifyOutput {
  verified: boolean;
  contractAddress: string;
  tokenColor: string;
  derivedTokenColor: string;
  balance: string;
}

export async function verify(ctx: AppContext, contractAddress: string, tokenColor: string): Promise<VerifyOutput> {
  console.error(`Verifying token balance for ${contractAddress}...`);
  const derivedTokenColor = deriveTokenColor(tokenColor, contractAddress);
  console.error('Syncing shielded wallet...');
  const shieldedState = await ctx.walletContext.walletFacade.shielded.waitForSyncedState();
  const balance = shieldedState.balances[derivedTokenColor] || 0n;
  console.error(`Token balance: ${balance}`);

  return {
    verified: balance > 0n,
    contractAddress,
    tokenColor,
    derivedTokenColor,
    balance: balance.toString(),
  };
}

export interface SendOutput {
  txHash: string;
  derivedTokenColor: string;
  amount: string;
  recipientAddress: string;
}

export async function send(
  ctx: AppContext,
  derivedTokenColor: string,
  amount: bigint,
  recipientSeedHex: string
): Promise<SendOutput> {
  console.error(`[send] Sending ${amount} tokens of color ${derivedTokenColor.slice(0, 8)}...`);

  // Derive recipient's keys from their seed
  const networkConfig = getNetworkConfig();
  const recipientKeys = deriveWalletKeys(recipientSeedHex, networkConfig.networkId);

  // The ledger types CoinPublicKey and EncPublicKey are already strings
  const coinPubKeyHex = recipientKeys.shieldedSecretKeys.coinPublicKey;
  const encPubKeyHex = recipientKeys.shieldedSecretKeys.encryptionPublicKey;

  const shieldedCoinPublicKey = ShieldedCoinPublicKey.fromHexString(coinPubKeyHex);
  const shieldedEncryptionPublicKey = ShieldedEncryptionPublicKey.fromHexString(encPubKeyHex);

  // Create the shielded address and encode it
  const recipientShieldedAddress = new ShieldedAddress(shieldedCoinPublicKey, shieldedEncryptionPublicKey);
  const recipientAddress = MidnightBech32m.encode(networkConfig.networkId, recipientShieldedAddress).asString();

  console.error(`[send] Recipient address: ${recipientAddress.slice(0, 20)}...`);

  // Check sender's balance first
  const shieldedState = await ctx.walletContext.walletFacade.shielded.waitForSyncedState();
  const balance = shieldedState.balances[derivedTokenColor] || 0n;
  console.error(`[send] Current balance: ${balance}`);

  if (balance < amount) {
    throw new Error(`Insufficient balance: have ${balance}, need ${amount}`);
  }

  // Build the transfer transaction using walletFacade (handles both shielded + dust)
  console.error('[send] Building transfer transaction...');
  const ttl = new Date(Date.now() + 5 * 60 * 1000); // 5 minute TTL
  const recipe = await ctx.walletContext.walletFacade.transferTransaction(
    ctx.walletContext.keys.shieldedSecretKeys,
    ctx.walletContext.keys.dustSecretKey,
    [{
      type: 'shielded',
      outputs: [{ amount, type: derivedTokenColor, receiverAddress: recipientAddress }],
    }],
    ttl
  );

  // Finalize the transaction (proves it)
  console.error('[send] Finalizing transaction...');
  const finalizedTx = await ctx.walletContext.walletFacade.finalizeTransaction({
    type: 'TransactionToProve',
    transaction: recipe.transaction,
  });

  // Submit the transaction
  console.error('[send] Submitting transaction...');
  const txId = await ctx.walletContext.walletFacade.submitTransaction(finalizedTx);

  console.error(`[send] Transfer complete, tx id: ${txId}`);

  return {
    txHash: txId,
    derivedTokenColor,
    amount: amount.toString(),
    recipientAddress,
  };
}
