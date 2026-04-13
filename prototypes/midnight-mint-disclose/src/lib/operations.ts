import * as crypto from 'crypto';
import { persistentHash as ledgerPersistentHash } from '@midnight-ntwrk/ledger-v8';
import { submitCallTx, withContractScopedTransaction, getPublicStates } from '@midnight-ntwrk/midnight-js-contracts';
import { AppContext, buildProviders, deployContractWithDryRun, createLogger } from '@capacity-exchange/midnight-node';
import { toTxResult, type TxResult } from '@sundaeswap/capacity-exchange-core';
import { CompiledMintDiscloseContract, MintDiscloseContract } from './contract.js';
import { createPrivateState } from './witnesses.js';
import { ledger as decodeLedger } from '../../out/contract/index.js';

const logger = createLogger(import.meta);

// ---------- helpers ----------

/** Compute Compact's persistentHash<Bytes<32>> of a 32-byte value off-chain. */
export function persistentHashBytes32(value: Uint8Array): Uint8Array {
  const alignment = [{ tag: 'atom' as const, value: { tag: 'bytes' as const, length: 32 } }];
  return ledgerPersistentHash(alignment, [value])[0];
}

export function randomBytes32(): Uint8Array {
  return crypto.randomBytes(32);
}

/** Update the stored private state so the next `preimage()` witness call returns `s`. */
async function stagePreimage(
  providers: ReturnType<typeof buildProviders<MintDiscloseContract>>,
  privateStateId: string,
  s: Uint8Array
): Promise<void> {
  await providers.privateStateProvider.set(privateStateId, createPrivateState(s));
}

// ---------- deploy ----------

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
  privateStateId: string;
}

export async function deploy(ctx: AppContext): Promise<DeployOutput> {
  logger.info('Deploying mint-disclose prototype contract...');
  const providers = buildProviders<MintDiscloseContract>(ctx, './out');
  const privateStateId = crypto.randomBytes(32).toString('hex');
  const initialPrivateState = createPrivateState(new Uint8Array(32));

  const deployed = await deployContractWithDryRun(
    providers,
    {
      compiledContract: CompiledMintDiscloseContract,
      args: [],
      privateStateId,
      initialPrivateState,
    },
    false
  );

  const contractAddress = deployed.deployTxData.public.contractAddress;
  logger.info(`Contract deployed at ${contractAddress}`);
  return {
    contractAddress,
    txHash: deployed.deployTxData.public.txHash,
    privateStateId,
  };
}

// ---------- Test A: mint alone ----------

export interface MintOutput {
  tx: TxResult;
  h: string; // hex
  s: string; // hex — the preimage we disclosed
  derivedColor: string; // hex — hex-encoded tokenType(h, contract)
}

export async function mintReveal(
  ctx: AppContext,
  contractAddress: string,
  privateStateId: string,
  s: Uint8Array,
  recipient: { is_left: boolean; left: Uint8Array; right: Uint8Array }
): Promise<MintOutput> {
  const h = persistentHashBytes32(s);
  logger.info(`mintReveal: h=${Buffer.from(h).toString('hex').slice(0, 16)}...`);

  const providers = buildProviders<MintDiscloseContract>(ctx, './out');
  await stagePreimage(providers, privateStateId, s);

  const result = await submitCallTx<MintDiscloseContract, 'mintReveal'>(providers, {
    compiledContract: CompiledMintDiscloseContract,
    contractAddress,
    circuitId: 'mintReveal',
    privateStateId,
    args: [h, recipient],
  });

  if (!result.private.result) {
    throw new Error('mintReveal returned no result');
  }
  const derivedColor = Buffer.from(result.private.result as Uint8Array).toString('hex');

  return {
    tx: toTxResult(contractAddress, result.public),
    h: Buffer.from(h).toString('hex'),
    s: Buffer.from(s).toString('hex'),
    derivedColor,
  };
}

// ---------- Test B: absorb alone (expected to fail) ----------

export interface AbsorbAttemptOutput {
  succeeded: boolean;
  error?: string;
  tx?: TxResult;
}

export async function absorbAlone(
  ctx: AppContext,
  contractAddress: string,
  privateStateId: string,
  h: Uint8Array
): Promise<AbsorbAttemptOutput> {
  logger.info(`absorb alone: h=${Buffer.from(h).toString('hex').slice(0, 16)}...`);
  const providers = buildProviders<MintDiscloseContract>(ctx, './out');

  try {
    const result = await submitCallTx<MintDiscloseContract, 'absorb'>(providers, {
      compiledContract: CompiledMintDiscloseContract,
      contractAddress,
      circuitId: 'absorb',
      privateStateId,
      args: [h],
    });
    return { succeeded: true, tx: toTxResult(contractAddress, result.public) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.info(`absorb alone failed as expected: ${msg}`);
    return { succeeded: false, error: msg };
  }
}

// ---------- Test C: mint + absorb in a single multi-action intent ----------

export interface MintAndAbsorbOutput {
  tx: TxResult;
  h: string;
  s: string;
}

export async function mintAndAbsorbAtomic(
  ctx: AppContext,
  contractAddress: string,
  privateStateId: string,
  s: Uint8Array,
  recipient: { is_left: boolean; left: Uint8Array; right: Uint8Array }
): Promise<MintAndAbsorbOutput> {
  const h = persistentHashBytes32(s);
  logger.info(`mint+absorb atomic: h=${Buffer.from(h).toString('hex').slice(0, 16)}...`);

  const providers = buildProviders<MintDiscloseContract>(ctx, './out');
  await stagePreimage(providers, privateStateId, s);

  const finalized = await withContractScopedTransaction<MintDiscloseContract>(providers, async (txCtx) => {
    await submitCallTx<MintDiscloseContract, 'mintReveal'>(
      providers,
      {
        compiledContract: CompiledMintDiscloseContract,
        contractAddress,
        circuitId: 'mintReveal',
        privateStateId,
        args: [h, recipient],
      },
      txCtx
    );
    await submitCallTx<MintDiscloseContract, 'absorb'>(
      providers,
      {
        compiledContract: CompiledMintDiscloseContract,
        contractAddress,
        circuitId: 'absorb',
        privateStateId,
        args: [h],
      },
      txCtx
    );
  });

  return {
    tx: toTxResult(contractAddress, finalized.public),
    h: Buffer.from(h).toString('hex'),
    s: Buffer.from(s).toString('hex'),
  };
}

// ---------- state query: verify s is on-chain ----------

export interface DisclosedPreimageLookup {
  present: boolean;
  s?: string; // hex
}

export async function queryDisclosedPreimage(
  ctx: AppContext,
  contractAddress: string,
  h: Uint8Array
): Promise<DisclosedPreimageLookup> {
  const publicStates = await getPublicStates(ctx.publicDataProvider, contractAddress);
  const ledger = decodeLedger(publicStates.contractState.data) as {
    disclosedPreimages: {
      member(key: Uint8Array): boolean;
      lookup(key: Uint8Array): Uint8Array;
    };
  };
  if (!ledger.disclosedPreimages.member(h)) {
    return { present: false };
  }
  const s = ledger.disclosedPreimages.lookup(h);
  return { present: true, s: Buffer.from(s).toString('hex') };
}
