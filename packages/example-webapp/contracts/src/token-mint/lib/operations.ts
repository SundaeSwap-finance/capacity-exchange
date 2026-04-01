import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { persistentHash as ledgerPersistentHash } from '@midnight-ntwrk/ledger-v8';
import { AppContext, buildProviders, submitStatefulCallTxDirect, deployContractWithDryRun } from '@capacity-exchange/midnight-node';
import { toTxResult, type TxResult } from '@capacity-exchange/midnight-core';
import { CompiledTokenMintContract, TokenMintContract } from './contract.js';
import { deriveTokenColor, getShieldedBalance } from '@capacity-exchange/midnight-core';
import { createPrivateState } from './witnesses.js';
import { createLogger } from '@capacity-exchange/midnight-node';

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
  tokenColor: string;
  derivedTokenColor: string;
  privateStateId: string;
  adminKeyHash: string;
}

export function generateTokenColor(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** Compute the Compact persistentHash<Bytes<32>> of a 32-byte value off-chain */
function persistentHashBytes32(value: Uint8Array): Uint8Array {
  const alignment = [{ tag: 'atom' as const, value: { tag: 'bytes' as const, length: 32 } }];
  const result = ledgerPersistentHash(alignment, [value]);
  return result[0];
}

export async function deploy(ctx: AppContext, tokenColor?: string, dryRun = false): Promise<DeployOutput> {
  const resolvedTokenColor = tokenColor ?? generateTokenColor();
  logger.info(`Deploying token-mint contract with color ${resolvedTokenColor.slice(0, 8)}...`);

  const providers = buildProviders<TokenMintContract>(ctx, './token-mint/out');
  const initialNonce = crypto.randomBytes(32);

  // Generate random admin key and compute its persistent hash
  const adminSecretKey = crypto.randomBytes(32);
  const adminKeyHash = persistentHashBytes32(adminSecretKey);
  logger.info(`Generated admin key hash: ${Buffer.from(adminKeyHash).toString('hex').slice(0, 16)}...`);

  // Save admin secret key to disk
  const adminKeyPath = path.resolve(import.meta.dirname, '../../../..', '.admin-key.json');
  fs.writeFileSync(
    adminKeyPath,
    JSON.stringify(
      {
        adminSecretKey: Buffer.from(adminSecretKey).toString('hex'),
        adminKeyHash: Buffer.from(adminKeyHash).toString('hex'),
      },
      null,
      2,
    ) + '\n',
  );
  logger.info(`Admin secret key saved to ${adminKeyPath}`);

  const privateStateId = crypto.randomBytes(32).toString('hex');
  logger.info(`Generated private state ID: ${privateStateId}`);
  const initialPrivateState = createPrivateState(crypto.randomBytes(32), adminSecretKey);
  logger.info('Created initial private state');

  // Deploy with max_depositors = 0 (deposits disabled until admin enables)
  logger.info(`Calling deployContract${dryRun ? ' (DRY RUN)' : ''}...`);
  const deployed = await deployContractWithDryRun(providers, {
    compiledContract: CompiledTokenMintContract,
    args: [Buffer.from(resolvedTokenColor, 'hex'), initialNonce, adminKeyHash, 0n],
    privateStateId,
    initialPrivateState,
  }, dryRun);

  const contractAddress = deployed.deployTxData.public.contractAddress;
  const derivedColor = deriveTokenColor(resolvedTokenColor, contractAddress);
  logger.info(`Token-mint deployed at ${contractAddress}`);
  logger.info(`Derived token color: ${derivedColor}`);
  return {
    contractAddress,
    txHash: deployed.deployTxData.public.txHash,
    tokenColor: resolvedTokenColor,
    derivedTokenColor: derivedColor,
    privateStateId,
    adminKeyHash: Buffer.from(adminKeyHash).toString('hex'),
  };
}

export interface MintOutput {
  tx: TxResult;
  amount: string;
  derivedTokenColor: string;
}

export async function mint(
  ctx: AppContext,
  contractAddress: string,
  privateStateId: string,
  amount: bigint
): Promise<MintOutput> {
  logger.info(`Minting ${amount} tokens at ${contractAddress}...`);
  logger.info(`Private state ID: ${privateStateId}`);
  const providers = buildProviders<TokenMintContract>(ctx, './token-mint/out');

  logger.info('Submitting mint transaction...');
  const result = await submitStatefulCallTxDirect<TokenMintContract, 'mint_test_tokens'>(providers, {
    compiledContract: CompiledTokenMintContract,
    contractAddress,
    circuitId: 'mint_test_tokens',
    privateStateId,
    args: [amount],
  });

  if (!result.private.result) {
    throw new Error('Mint transaction succeeded but no result returned');
  }

  const derivedTokenColor = Buffer.from(result.private.result.color).toString('hex');
  logger.info(`Mint confirmed, derived color: ${derivedTokenColor.slice(0, 8)}...`);

  return {
    tx: toTxResult(contractAddress, result.public),
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
  logger.info(`Verifying token balance for ${contractAddress}...`);
  const derivedTokenColor = deriveTokenColor(tokenColor, contractAddress);
  const balance = await getShieldedBalance(ctx.walletContext.walletFacade, derivedTokenColor);
  logger.info(`Token balance: ${balance}`);

  return {
    verified: balance > 0n,
    contractAddress,
    tokenColor,
    derivedTokenColor,
    balance: balance.toString(),
  };
}
