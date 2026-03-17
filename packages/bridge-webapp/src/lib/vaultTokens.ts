import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import { deriveTokenColor } from '@capacity-exchange/midnight-core';
import { getVaultConfig } from './config';

export interface ShieldedToken {
  color: string;
  balance: bigint;
  vaultLabel: string;
  domainSep: string;
}

interface VaultInfo {
  label: string;
  domainSep: string;
}

/**
 * Given the config'd vault contract address and token types, derives each
 * token's color and builds a map from color to VaultInfo (display label +
 * domain separator). Used to identify which of the user's shielded balances
 * correspond to bridged-recognized tokens.
 */
export function buildColorToVaultMap(): Map<string, VaultInfo> {
  const { contractAddress, tokenTypes } = getVaultConfig();
  const map = new Map<string, VaultInfo>();
  for (const tt of tokenTypes) {
    try {
      const color = deriveTokenColor(tt.domainSep, contractAddress);
      map.set(color, { label: tt.label, domainSep: tt.domainSep });
    } catch (err) {
      throw new Error(`Failed to derive token color for "${tt.label}" (domainSep=${tt.domainSep}): ${err}`);
    }
  }
  return map;
}

/**
 * Filters a wallet's shielded balances to only those that match a known vault
 * token type.
 */
export function matchVaultTokens(
  balances: Record<string, bigint>,
  colorToVault: Map<string, VaultInfo>
): ShieldedToken[] {
  return Object.entries(balances)
    .filter(([color, balance]) => balance > 0n && colorToVault.has(color))
    .map(([color, balance]) => {
      const vault = colorToVault.get(color)!;
      return { color, balance, vaultLabel: vault.label, domainSep: vault.domainSep };
    });
}

/** Fetch shielded balances from the wallet and filter to tokens recognized by the vault config. */
export async function fetchVaultTokens(wallet: ConnectedAPI): Promise<ShieldedToken[]> {
  const balances = await wallet.getShieldedBalances();
  return matchVaultTokens(balances, buildColorToVaultMap());
}
