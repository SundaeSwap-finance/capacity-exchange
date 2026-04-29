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

// ---------- deploy ----------

export interface DeployOutput {
  contractAddress: string;
  txHash: string;
  privateStateId: string;
}

export async function deploy(ctx: AppContext, sPrime: Uint8Array): Promise<DeployOutput> {
  logger.info('Deploying mint-disclose prototype contract...');
  const providers = buildProviders<MintDiscloseContract>(ctx, './out');
  const privateStateId = crypto.randomBytes(32).toString('hex');
  const initialPrivateState = createPrivateState(sPrime);

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
  s: string; // hex — the disclosed public secret
  hs: string; // hex — hash(s), the disclosedPreimages key
  derivedColor: string; // hex — the mint's combined color hash(hash(s) ++ hash(s'))
}

export async function mintReveal(
  ctx: AppContext,
  contractAddress: string,
  privateStateId: string,
  s: Uint8Array
): Promise<MintOutput> {
  const hs = persistentHashBytes32(s);
  logger.info(`mintReveal: hash(s)=${Buffer.from(hs).toString('hex').slice(0, 16)}...`);

  const providers = buildProviders<MintDiscloseContract>(ctx, './out');

  const result = await submitCallTx<MintDiscloseContract, 'mintReveal'>(providers, {
    compiledContract: CompiledMintDiscloseContract,
    contractAddress,
    circuitId: 'mintReveal',
    privateStateId,
    args: [s],
  });

  if (!result.private.result) {
    throw new Error('mintReveal returned no result');
  }
  const derivedColor = Buffer.from(result.private.result as Uint8Array).toString('hex');

  return {
    tx: toTxResult(contractAddress, result.public),
    s: Buffer.from(s).toString('hex'),
    hs: Buffer.from(hs).toString('hex'),
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
  h: Uint8Array,
  hPrime: Uint8Array
): Promise<AbsorbAttemptOutput> {
  logger.info(`absorb alone: h=${Buffer.from(h).toString('hex').slice(0, 16)}... h'=${Buffer.from(hPrime).toString('hex').slice(0, 16)}...`);
  const providers = buildProviders<MintDiscloseContract>(ctx, './out');

  try {
    const result = await submitCallTx<MintDiscloseContract, 'absorb'>(providers, {
      compiledContract: CompiledMintDiscloseContract,
      contractAddress,
      circuitId: 'absorb',
      privateStateId,
      args: [h, hPrime],
    });
    return { succeeded: true, tx: toTxResult(contractAddress, result.public) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.info(`absorb alone failed as expected: ${msg}`);
    return { succeeded: false, error: msg };
  }
}

// ---------- Tests C / C': mint + absorb in a single merged transaction ----------

export interface MintAndAbsorbAttemptOutput {
  succeeded: boolean;
  error?: string;
  tx?: TxResult;
  s: string; // hex
  hs: string; // hex
  hPrimeUsed: string; // hex — the h' passed to absorb (which test C' sets to a wrong value)
}

/**
 * Executes mintReveal(s) and absorb(hash(s), hPrime) in one merged transaction.
 *
 * Returns succeeded: true when hPrime matches hash of the witness s' that
 * the contract was deployed with — the mint color hash(hash(s) ++ hash(s'))
 * matches the absorb color hash(hash(s) ++ hPrime), the merge balances, the
 * transaction finalizes.
 *
 * Returns succeeded: false when hPrime does not match hash(s'). The colors
 * differ, the merge fails the ledger balance check. This is the load-bearing
 * demonstration of the LP-front-run defense: an LP cannot produce a balancing
 * transaction without the user's private witness s'.
 */
export async function mintAndAbsorbAttempt(
  ctx: AppContext,
  contractAddress: string,
  privateStateId: string,
  s: Uint8Array,
  hPrime: Uint8Array
): Promise<MintAndAbsorbAttemptOutput> {
  const hs = persistentHashBytes32(s);
  logger.info(
    `mint+absorb: hash(s)=${Buffer.from(hs).toString('hex').slice(0, 16)}... ` +
      `h'=${Buffer.from(hPrime).toString('hex').slice(0, 16)}...`
  );

  const providers = buildProviders<MintDiscloseContract>(ctx, './out');

  try {
    const finalized = await withContractScopedTransaction<MintDiscloseContract>(providers, async (txCtx) => {
      await submitCallTx<MintDiscloseContract, 'mintReveal'>(
        providers,
        {
          compiledContract: CompiledMintDiscloseContract,
          contractAddress,
          circuitId: 'mintReveal',
          privateStateId,
          args: [s],
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
          args: [hs, hPrime],
        },
        txCtx
      );
    });
    return {
      succeeded: true,
      tx: toTxResult(contractAddress, finalized.public),
      s: Buffer.from(s).toString('hex'),
      hs: Buffer.from(hs).toString('hex'),
      hPrimeUsed: Buffer.from(hPrime).toString('hex'),
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.info(`mint+absorb failed: ${msg}`);
    return {
      succeeded: false,
      error: msg,
      s: Buffer.from(s).toString('hex'),
      hs: Buffer.from(hs).toString('hex'),
      hPrimeUsed: Buffer.from(hPrime).toString('hex'),
    };
  }
}

// ---------- state query: verify s is on-chain ----------

export interface DisclosedPreimageLookup {
  present: boolean;
  s?: string; // hex
}

export async function queryDisclosedPreimage(
  ctx: AppContext,
  contractAddress: string,
  hs: Uint8Array
): Promise<DisclosedPreimageLookup> {
  const publicStates = await getPublicStates(ctx.publicDataProvider, contractAddress);
  const ledger = decodeLedger(publicStates.contractState.data) as {
    disclosedPreimages: {
      member(key: Uint8Array): boolean;
      lookup(key: Uint8Array): Uint8Array;
    };
  };
  if (!ledger.disclosedPreimages.member(hs)) {
    return { present: false };
  }
  const s = ledger.disclosedPreimages.lookup(hs);
  return { present: true, s: Buffer.from(s).toString('hex') };
}
