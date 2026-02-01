import * as crypto from 'crypto';
import { deployContract, findDeployedContract, submitCallTx } from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext } from '../../lib/app-context.js';
import { getContractProviders } from '../../lib/providers/contract.js';
import { createTokenMintContract, TokenMintContract } from './contract.js';
import { deriveTokenColor } from './token-color.js';
import { createPrivateState } from './witnesses.js';

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
