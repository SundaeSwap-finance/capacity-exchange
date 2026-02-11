import * as crypto from 'crypto';
import { deployContract, findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext } from '../../lib/app-context.js';
import { getContractProviders } from '../../lib/providers/contract.js';
import { createTokenMintContract, TokenMintContract } from './contract.js';
import { deriveTokenColor } from './token-color.js';
import { createPrivateState } from './witnesses.js';
import { createLogger } from '../../lib/logger.js';

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
  tokenColor: string;
  derivedTokenColor: string;
  privateStateId: string;
}

export function generateTokenColor(): string {
  return crypto.randomBytes(32).toString('hex');
}

export async function deploy(ctx: AppContext, tokenColor?: string): Promise<DeployOutput> {
  const resolvedTokenColor = tokenColor ?? generateTokenColor();
  logger.log(`Deploying token-mint contract with color ${resolvedTokenColor.slice(0, 8)}...`);

  const providers = getContractProviders<TokenMintContract>(ctx);
  const contract = createTokenMintContract();
  const initialNonce = crypto.randomBytes(32);

  const privateStateId = crypto.randomBytes(32).toString('hex');
  logger.log(`Generated private state ID: ${privateStateId}`);
  const initialPrivateState = createPrivateState(crypto.randomBytes(32));
  logger.log('Created initial private state');

  logger.log('Calling deployContract...');
  const deployed = await deployContract(providers, {
    contract,
    args: [Buffer.from(resolvedTokenColor, 'hex'), initialNonce],
    privateStateId,
    initialPrivateState,
  });

  const contractAddress = deployed.deployTxData.public.contractAddress;
  const derivedColor = deriveTokenColor(resolvedTokenColor, contractAddress);
  logger.log(`Token-mint deployed at ${contractAddress}`);
  logger.log(`Derived token color: ${derivedColor}`);
  return {
    contractAddress,
    txHash: deployed.deployTxData.public.txHash,
    tokenColor: resolvedTokenColor,
    derivedTokenColor: derivedColor,
    privateStateId,
  };
}

export interface MintOutput {
  txHash: string;
  contractAddress: string;
  amount: string;
  derivedTokenColor: string;
  blockHeight: string;
  blockHash: string;
}

export async function mint(
  ctx: AppContext,
  contractAddress: string,
  privateStateId: string,
  amount: bigint
): Promise<MintOutput> {
  logger.log(`Minting ${amount} tokens at ${contractAddress}...`);
  logger.log(`Private state ID: ${privateStateId}`);
  const providers = getContractProviders<TokenMintContract>(ctx);
  const contract = createTokenMintContract();

  logger.log('Looking up deployed contract...');
  await findDeployedContract(providers, {
    contract,
    contractAddress,
    privateStateId,
  });
  logger.log('Found deployed contract');

  logger.log('Submitting mint transaction...');
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
  logger.log(`Mint confirmed, derived color: ${derivedTokenColor.slice(0, 8)}...`);

  return {
    txHash: result.public.txHash,
    contractAddress,
    amount: amount.toString(),
    derivedTokenColor,
    blockHeight: result.public.blockHeight.toString(),
    blockHash: result.public.blockHash,
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
  logger.log(`Verifying token balance for ${contractAddress}...`);
  const derivedTokenColor = deriveTokenColor(tokenColor, contractAddress);
  logger.log('Syncing shielded wallet...');
  const shieldedState = await ctx.walletContext.walletFacade.shielded.waitForSyncedState();
  const balance = shieldedState.balances[derivedTokenColor] || 0n;
  logger.log(`Token balance: ${balance}`);

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
  contractAddress: string;
  tokenColor: string;
  derivedTokenColor: string;
  amount: string;
  recipientAddress: string;
}

export async function send(
  ctx: AppContext,
  contractAddress: string,
  tokenColor: string,
  recipientAddress: string,
  amount: bigint
): Promise<SendOutput> {
  const derivedTokenColor = deriveTokenColor(tokenColor, contractAddress);
  logger.log(`Sending ${amount} tokens (color: ${derivedTokenColor.slice(0, 8)}...) to ${recipientAddress}...`);

  logger.log('Syncing shielded wallet...');
  const shieldedState = await ctx.walletContext.walletFacade.shielded.waitForSyncedState();
  const balance = shieldedState.balances[derivedTokenColor] || 0n;
  logger.log(`Current balance: ${balance}`);

  if (balance < amount) {
    throw new Error(`Insufficient balance: have ${balance}, need ${amount}`);
  }

  // Create a TTL 5 minutes from now
  const ttl = new Date(Date.now() + 5 * 60 * 1000);

  logger.log('Creating transfer transaction...');
  const { shieldedSecretKeys, dustSecretKey } = ctx.walletContext.keys;
  const transferRecipe = await ctx.walletContext.walletFacade.transferTransaction(
    shieldedSecretKeys,
    dustSecretKey,
    [
      {
        type: 'shielded',
        outputs: [
          {
            type: derivedTokenColor,
            receiverAddress: recipientAddress,
            amount,
          },
        ],
      },
    ],
    ttl
  );

  logger.log('Finalizing transaction...');
  const finalizedTx = await ctx.walletContext.walletFacade.finalizeTransaction(transferRecipe);
  logger.log('Submitting transaction...');
  const txHash = await ctx.walletContext.walletFacade.submitTransaction(finalizedTx);

  logger.log(`Transfer complete, tx hash: ${txHash}`);
  return {
    txHash,
    contractAddress,
    tokenColor,
    derivedTokenColor,
    amount: amount.toString(),
    recipientAddress,
  };
}
