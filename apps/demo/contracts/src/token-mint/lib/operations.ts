import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import {
  AppContext,
  buildProviders,
  submitStatefulCallTxDirect,
  deployContractWithDryRun,
  recordDeployment,
  sampleMaintenanceKey,
} from '@sundaeswap/capacity-exchange-nodejs';
import { toTxResult, type TxResult } from '@sundaeswap/capacity-exchange-core';
import { CompiledTokenMintContract, TokenMintContract } from './contract.js';
import { deriveTokenColor, getShieldedBalance } from '@sundaeswap/capacity-exchange-core';
import { persistentHash, CompactTypeBytes, type SigningKey } from '@midnight-ntwrk/compact-runtime';
import { createPrivateState } from './witnesses.js';
import { createLogger } from '@sundaeswap/capacity-exchange-nodejs';

const Bytes32Descriptor = new CompactTypeBytes(32);

const logger = createLogger(import.meta);

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
  tokenColor: string;
  derivedTokenColor: string;
  privateStateId: string;
  adminKeyHash: string;
  /** The contract maintenance authority's key, needed to rotate verifier keys. */
  maintenanceSigningKey: SigningKey;
  /** The Secrets Manager secret holding `maintenanceSigningKey`, for rotate-verifier-keys
   *  --signing-key-secret. Absent when it was not stored. */
  maintenanceKeySecretArn?: string;
}

export function generateTokenColor(): string {
  return crypto.randomBytes(32).toString('hex');
}

/** @param storeMaintenanceKey Store the maintenance signing key in a new Secrets Manager secret. */
export async function deploy(
  ctx: AppContext,
  tokenColor?: string,
  dryRun = false,
  storeMaintenanceKey = false
): Promise<DeployOutput> {
  const networkId = ctx.config.network.networkName;
  const resolvedTokenColor = tokenColor ?? generateTokenColor();
  logger.info(`Deploying token-mint contract with color ${resolvedTokenColor.slice(0, 8)}...`);

  const providers = buildProviders<TokenMintContract>(ctx, './token-mint/out');
  const initialNonce = crypto.randomBytes(32);

  // Generate random admin key and compute its persistent hash
  const adminSecretKey = crypto.randomBytes(32);
  const adminKeyHash = persistentHash(Bytes32Descriptor, adminSecretKey);
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
      2
    ) + '\n'
  );
  logger.info(`Admin secret key saved to ${adminKeyPath}`);

  const privateStateId = crypto.randomBytes(32).toString('hex');
  logger.info(`Generated private state ID: ${privateStateId}`);
  const initialPrivateState = createPrivateState(crypto.randomBytes(32), adminSecretKey);
  logger.info('Created initial private state');
  // Sampled here rather than by deployContract so it can be returned: otherwise its only copy is
  // the local private state store, and losing that leaves the contract unmaintainable.
  // With a secret name, it is stored before the deploy is submitted.
  const maintenanceKey = await sampleMaintenanceKey({
    store: storeMaintenanceKey,
    networkId,
    contract: 'token-mint',
    dryRun,
  });

  // Deploy with max_depositors = 0 (deposits disabled until admin enables)
  logger.info(`Calling deployContract${dryRun ? ' (DRY RUN)' : ''}...`);
  const deployed = await deployContractWithDryRun(
    providers,
    {
      compiledContract: CompiledTokenMintContract,
      args: [Buffer.from(resolvedTokenColor, 'hex'), initialNonce, adminKeyHash, 0n],
      privateStateId,
      initialPrivateState,
      signingKey: maintenanceKey.signingKey,
    },
    dryRun
  );

  const contractAddress = deployed.deployTxData.public.contractAddress;
  const derivedColor = deriveTokenColor(resolvedTokenColor, contractAddress);
  logger.info(`Token-mint deployed at ${contractAddress}`);
  logger.info(`Derived token color: ${derivedColor}`);
  const txHash = deployed.deployTxData.public.txHash;
  await recordDeployment(maintenanceKey, { networkId, contract: 'token-mint', contractAddress, txHash });
  return {
    contractAddress,
    txHash,
    tokenColor: resolvedTokenColor,
    derivedTokenColor: derivedColor,
    privateStateId,
    adminKeyHash: Buffer.from(adminKeyHash).toString('hex'),
    maintenanceSigningKey: maintenanceKey.signingKey,
    maintenanceKeySecretArn: maintenanceKey.secretArn,
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
