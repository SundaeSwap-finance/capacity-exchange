import * as fs from 'fs';
import * as path from 'path';

export interface TokenMintConfig {
  contractAddress: string;
  txHash: string;
  tokenColor: string;
  privateStateId: string;
}

export interface CounterConfig {
  contractAddress: string;
  txHash: string;
}

export interface ContractsConfig {
  networkId: string;
  tokenMint: TokenMintConfig;
  counter: CounterConfig;
}

export function getConfigPath(networkId: string): string {
  return path.resolve(import.meta.dirname, '../..', `.contracts.${networkId}.json`);
}

export function loadContractsConfig(networkId: string): ContractsConfig | null {
  const configPath = getConfigPath(networkId);
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as ContractsConfig;
  } catch {
    return null;
  }
}

export function saveContractsConfig(networkId: string, config: ContractsConfig): void {
  const configPath = getConfigPath(networkId);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}
