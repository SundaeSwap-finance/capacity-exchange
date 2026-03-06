import type { InitialAPI, ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import {
  MidnightBech32m,
  ShieldedAddress,
  ShieldedCoinPublicKey,
  ShieldedEncryptionPublicKey,
} from '@midnight-ntwrk/wallet-sdk-address-format';

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
  | { ok: true; connector: InitialAPI }
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
  for (const value of Object.values(midnight)) {
    if (
      value &&
      typeof value === 'object' &&
      'connect' in value &&
      typeof (value as InitialAPI).connect === 'function'
    ) {
      return { ok: true, connector: value as InitialAPI };
    }
  }
  return { ok: false, reason: 'no-compatible-connector', keys: Object.keys(midnight) };
}

export type ConnectMidnightExtensionResult = { ok: true; wallet: ConnectedAPI } | { ok: false; error: string };

/** Detects and connects to the Midnight wallet extension. */
export async function connectMidnightExtension(networkId: string): Promise<ConnectMidnightExtensionResult> {
  const detected = detectMidnightExtension();
  if ('reason' in detected) {
    return { ok: false, error: `Extension not found (${detected.reason})` };
  }

  try {
    const wallet = await detected.connector.connect(networkId);
    return { ok: true, wallet };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to connect to Midnight wallet' };
  }
}
