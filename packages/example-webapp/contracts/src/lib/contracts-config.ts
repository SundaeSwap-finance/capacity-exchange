import * as fs from 'fs';
import * as path from 'path';

export interface TokenMintConfig {
  contractAddress: string;
  txHash: string;
  tokenColor: string;
  derivedTokenColor: string;
  privateStateId: string;
  adminKeyHash: string;
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

  // Write a public config with sensitive fields stripped (served to browsers)
  const { privateStateId: _ps, adminKeyHash: _ak, ...publicTokenMint } = config.tokenMint;
  const publicConfig = { networkId, tokenMint: publicTokenMint, counter: config.counter };
  const publicConfigPath = path.resolve(import.meta.dirname, '../..', `.contracts.${networkId}.public.json`);
  fs.writeFileSync(publicConfigPath, JSON.stringify(publicConfig, null, 2) + '\n');
}
