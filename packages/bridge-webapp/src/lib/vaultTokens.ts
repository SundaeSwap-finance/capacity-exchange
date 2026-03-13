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
  const map = new Map<string, VaultInfo>();
  try {
    const { contractAddress, tokenTypes } = getVaultConfig();
    for (const tt of tokenTypes) {
      const color = deriveTokenColor(tt.domainSep, contractAddress);
      map.set(color, { label: tt.label, domainSep: tt.domainSep });
    }
  } catch {
    // vault config not available
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
