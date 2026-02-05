import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const contractsDir = join(__dirname, '../../contracts');

export interface ContractsConfig {
  networkId: string;
  tokenMint: {
    contractAddress: string;
    txHash: string;
    tokenColor: string;
    privateStateId: string;
  };
  counter: {
    contractAddress: string;
    txHash: string;
  };
}

export type LoadContractsConfigResult =
  | { status: 'loaded'; config: ContractsConfig }
  | { status: 'not-found' }
  | { status: 'error'; error: string };

function getConfigPath(networkId: string): string {
  return join(contractsDir, `.contracts.${networkId}.json`);
}

export function loadContractsConfig(networkId: string): LoadContractsConfigResult {
  const configPath = getConfigPath(networkId);

  if (!existsSync(configPath)) {
    return { status: 'not-found' };
  }

  try {
    const config = JSON.parse(readFileSync(configPath, 'utf-8')) as ContractsConfig;
    return { status: 'loaded', config };
  } catch (err) {
    return { status: 'error', error: err instanceof Error ? err.message : 'Unknown error' };
  }
}
