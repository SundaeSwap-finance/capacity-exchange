import type { AppContext } from '@sundaeswap/capacity-exchange-nodejs';
import { createLogger } from '@sundaeswap/capacity-exchange-nodejs';
import { getNightBalance } from '@sundaeswap/capacity-exchange-core';
import { MidnightBech32m } from '@midnight-ntwrk/wallet-sdk-address-format';
import {
  computeRegistryKey,
  deploy,
  generateRandomSecretKey,
  ledger,
  register,
  deregister,
  registryEntries,
  type RegistryEntry,
  type RegistrySecretKey,
} from '@sundaeswap/capacity-exchange-registry';
import { buildFlowCtx, pollUntil, type FlowCtxConfig } from '../util/testUtils.js';

const logger = createLogger(import.meta);

const ENTRY_EXPIRY_MS = 7_200 * 1000; // 2 hours in milliseconds
const POLL_INTERVAL_MS = 5_000;
const POLL_TIMEOUT_MS = 2 * 60 * 1000;
const TEST_SRV_NAME = '_capacityexchange._tcp.test.example.com';
const EXPECTED_URL = TEST_SRV_NAME;

export interface RegistryFlowResult {
  registryAddress: string;
  registeredUrl: string;
}

export async function runRegistryFlow(networkId: string, flowConfig: FlowCtxConfig): Promise<RegistryFlowResult> {
  logger.info('Building registry-flow AppContext');
  const ctx = await buildFlowCtx(networkId, flowConfig);

  const { contractAddress: registryAddress } = await deployRegistry(ctx);

  logger.info({ registryAddress }, 'Starting registry flow');

  const balanceBefore = await assertSufficientCollateral(ctx, registryAddress);
  const { secretKey, registryKey } = await registerEntry(ctx, registryAddress);
  await waitForKeyPresent(ctx, registryAddress, secretKey, registryKey);
  await deregisterEntry(ctx, networkId, registryAddress, secretKey);
  await waitForKeyAbsent(ctx, registryAddress, secretKey, registryKey);
  await waitForCollateralRefund(ctx, balanceBefore);

  return { registryAddress, registeredUrl: EXPECTED_URL };
}

const REGISTRY_COLLATERAL = 1000n;
const REGISTRY_MAX_PERIOD = 18_000n; // 5 hours in seconds

async function deployRegistry(ctx: AppContext): Promise<{ contractAddress: string }> {
  logger.info('Deploying registry contract');
  const result = await deploy(ctx, { requiredCollateral: REGISTRY_COLLATERAL, maxPeriod: REGISTRY_MAX_PERIOD });
  logger.info({ contractAddress: result.contractAddress }, 'Registry deployed');
  return result;
}

async function assertSufficientCollateral(ctx: AppContext, registryAddress: string): Promise<bigint> {
  const collateralAmount = await getContractCollateralAmount(ctx, registryAddress);
  const balanceBefore = await getUnshieldedNightBalance(ctx);
  logger.info(
    { balanceBefore: balanceBefore.toString(), collateralAmount: collateralAmount.toString() },
    'Captured pre-register unshielded NIGHT balance'
  );
  if (balanceBefore < collateralAmount) {
    throw new Error(`Insufficient NIGHT for collateral: have ${balanceBefore}, need ${collateralAmount}`);
  }
  return balanceBefore;
}

async function registerEntry(
  ctx: AppContext,
  registryAddress: string
): Promise<{ secretKey: RegistrySecretKey; registryKey: string }> {
  const secretKey = generateRandomSecretKey();
  const registryKey = Buffer.from(computeRegistryKey(secretKey)).toString('hex');
  const entry: RegistryEntry = {
    address: TEST_SRV_NAME,
    expiry: new Date(Date.now() + ENTRY_EXPIRY_MS),
  };

  logger.info({ registryKey, srvName: TEST_SRV_NAME, expiry: entry.expiry.toISOString() }, 'Registering entry');
  await register(ctx, secretKey, { contractAddress: registryAddress, entry });
  return { secretKey, registryKey };
}

async function waitForKeyPresent(
  ctx: AppContext,
  registryAddress: string,
  secretKey: RegistrySecretKey,
  registryKey: string
): Promise<void> {
  logger.info('Polling for registered key to appear');
  await pollUntil(async () => await registryContainsKey(ctx, registryAddress, secretKey), {
    label: `registry key ${registryKey} to appear`,
    timeoutMs: POLL_TIMEOUT_MS,
    intervalMs: POLL_INTERVAL_MS,
  });
  logger.info('Registration verified');
}

async function deregisterEntry(
  ctx: AppContext,
  networkId: string,
  registryAddress: string,
  secretKey: RegistrySecretKey
): Promise<void> {
  const recipientAddress = await getUnshieldedAddress(ctx, networkId);
  logger.info('Deregistering entry');
  await deregister(ctx, { contractAddress: registryAddress, secretKey, recipientAddress });
}

async function waitForKeyAbsent(
  ctx: AppContext,
  registryAddress: string,
  secretKey: RegistrySecretKey,
  registryKey: string
): Promise<void> {
  logger.info('Polling for registered key to disappear');
  await pollUntil(async () => !(await registryContainsKey(ctx, registryAddress, secretKey)), {
    label: `registry key ${registryKey} to disappear`,
    timeoutMs: POLL_TIMEOUT_MS,
    intervalMs: POLL_INTERVAL_MS,
  });
  logger.info('Deregistration verified');
}

async function waitForCollateralRefund(ctx: AppContext, balanceBefore: bigint): Promise<void> {
  logger.info({ expected: balanceBefore.toString() }, 'Polling for collateral refund');
  await pollUntil(
    async () => {
      const current = await getUnshieldedNightBalance(ctx);
      logger.debug({ current: current.toString() }, 'Unshielded NIGHT balance');
      return current >= balanceBefore;
    },
    {
      label: `unshielded NIGHT balance to return to ${balanceBefore}`,
      timeoutMs: POLL_TIMEOUT_MS,
      intervalMs: POLL_INTERVAL_MS,
    }
  );
  logger.info('Collateral refund verified');
}

async function registryContainsKey(
  ctx: AppContext,
  registryAddress: string,
  secretKey: RegistrySecretKey
): Promise<boolean> {
  const contractState = await ctx.publicDataProvider.queryContractState(registryAddress);
  if (!contractState) {
    throw new Error(`No contract state found at registry address ${registryAddress}`);
  }
  const expected = computeRegistryKey(secretKey);
  const expectedHex = Buffer.from(expected).toString('hex');
  return registryEntries(ledger(contractState.data)).some(
    ({ key }) => Buffer.from(key).toString('hex') === expectedHex
  );
}

async function getContractCollateralAmount(ctx: AppContext, registryAddress: string): Promise<bigint> {
  const contractState = await ctx.publicDataProvider.queryContractState(registryAddress);
  if (!contractState) {
    throw new Error(`No contract state found at registry address ${registryAddress}`);
  }
  return ledger(contractState.data).collateralAmount;
}

async function getUnshieldedNightBalance(ctx: AppContext): Promise<bigint> {
  const state = await ctx.walletContext.walletFacade.unshielded.waitForSyncedState();
  return getNightBalance(state.balances);
}

async function getUnshieldedAddress(ctx: AppContext, networkId: string): Promise<string> {
  const state = await ctx.walletContext.walletFacade.waitForSyncedState();
  return MidnightBech32m.encode(networkId, state.unshielded.address).asString();
}
