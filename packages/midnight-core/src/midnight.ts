import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk/address-format';
import { withExtensionApprovalGuard, type ExtensionApprovalGuardOptions } from './extensionApprovalGuard.js';

export type ParseCoinPublicKeyResult = { ok: true; coinPublicKey: string } | { ok: false; error: string };

/** Extracts the coin public key hex from a Midnight shielded address. */
export function parseCoinPublicKey(shieldedMidnightAddress: string): ParseCoinPublicKeyResult {
  try {
    const parsed = MidnightBech32m.parse(shieldedMidnightAddress);
    const shieldedAddress = parsed.decode(ShieldedAddress, parsed.network);
    return { ok: true, coinPublicKey: shieldedAddress.coinPublicKey.toHexString() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid Midnight address' };
  }
}

export type EncodeShieldedAddressResult = { ok: true; address: string } | { ok: false; error: string };

/** Encodes a shielded address from raw hex components. */
export function encodeShieldedAddress(
  networkId: string,
  coinPublicKeyHex: string,
  encryptionPublicKeyHex: string
): EncodeShieldedAddressResult {
  try {
    const shieldedAddress = new ShieldedAddress(
      ShieldedCoinPublicKey.fromHexString(coinPublicKeyHex),
      ShieldedEncryptionPublicKey.fromHexString(encryptionPublicKeyHex)
    );
    return { ok: true, address: MidnightBech32m.encode(networkId, shieldedAddress).asString() };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to encode shielded address' };
  }
}

export type DetectMidnightExtensionResult =
  | { ok: true; connector: InitialAPI; /** `globalThis.midnight` key it was injected under. */ key: string }
  | { ok: false; reason: 'no-midnight' }
  | { ok: false; reason: 'no-compatible-connector'; keys: string[] };

/**
 * Detects a Midnight wallet extension via `globalThis.midnight`.
 * The extension may inject under `mnLace` or a UUID key,
 * so we check all entries for a connector with a `connect` method.
 */
export function detectMidnightExtension(): DetectMidnightExtensionResult {
  const midnight = (globalThis as { midnight?: Record<string, unknown> }).midnight;
  if (!midnight) {
    return { ok: false, reason: 'no-midnight' };
  }
  for (const [key, value] of Object.entries(midnight)) {
    if (
      value &&
      typeof value === 'object' &&
      'connect' in value &&
      typeof (value as InitialAPI).connect === 'function'
    ) {
      return { ok: true, connector: value as InitialAPI, key };
    }
  }
  return { ok: false, reason: 'no-compatible-connector', keys: Object.keys(midnight) };
}

export type ConnectMidnightExtensionResult = { ok: true; wallet: ConnectedAPI } | { ok: false; error: string };

/**
 * Wallets whose popup-teardown race {@link withExtensionApprovalGuard} works
 * around, matched against the connector's `name`, `rdns` and injection key.
 */
const APPROVAL_GUARD_WALLETS = /lace/i;

function needsApprovalGuard({ connector, key }: { connector: InitialAPI; key: string }): boolean {
  return [key, connector.name, connector.rdns].some(
    (value) => typeof value === 'string' && APPROVAL_GUARD_WALLETS.test(value)
  );
}

export interface ConnectMidnightExtensionOptions {
  /**
   * Guard the returned API against the wallet's popup-teardown race, which makes
   * back-to-back approvals fail with "User rejected transaction".
   *
   * Defaults to `'auto'`: guard only wallets known to have the bug
   * ({@link APPROVAL_GUARD_WALLETS}), so other wallets get their own API back
   * untouched. An options object also means `'auto'`, with those timings. Pass
   * `true` to guard whatever wallet connected, or `false` to opt out entirely.
   * See {@link withExtensionApprovalGuard}.
   */
  approvalGuard?: boolean | 'auto' | ExtensionApprovalGuardOptions;
}

/** Detects and connects to the Midnight wallet extension. */
export async function connectMidnightExtension(
  networkId: string,
  options: ConnectMidnightExtensionOptions = {}
): Promise<ConnectMidnightExtensionResult> {
  const detected = detectMidnightExtension();
  if ('reason' in detected) {
    return { ok: false, error: `Extension not found (${detected.reason})` };
  }

  try {
    const wallet = await detected.connector.connect(networkId);
    const { approvalGuard = 'auto' } = options;
    const guard = approvalGuard === true || (approvalGuard !== false && needsApprovalGuard(detected));
    if (!guard) {
      return { ok: true, wallet };
    }
    return {
      ok: true,
      wallet: withExtensionApprovalGuard(wallet, typeof approvalGuard === 'object' ? approvalGuard : {}),
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to connect to Midnight wallet' };
  }
}
