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

/** Path of the browser-facing deploy bundle. The Taskfile stages this to the webapp's
 *  `public/contracts.json`, which the demo loads at runtime. */
export function getDeployedConfigPath(networkId: string): string {
  return path.resolve(import.meta.dirname, '../..', `.contracts.${networkId}.deployed.json`);
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

  // Also emit the browser-facing bundle in the DeployedContracts shape the demo's
  // /contracts.json loader expects. This mirrors the hosted `derive-deployed-contracts`
  // output (per-contract records keyed `counter`/`token-mint`, addresses under `address`,
  // token colors under `public`). Sensitive fields (privateStateId, adminKeyHash) are
  // omitted; `sha` is meaningless for a local deploy and the loader ignores it.
  const deployed = {
    network: networkId,
    counter: {
      address: config.counter.contractAddress,
      txHash: config.counter.txHash,
      sha: 'local',
      network: networkId,
      public: {},
    },
    'token-mint': {
      address: config.tokenMint.contractAddress,
      txHash: config.tokenMint.txHash,
      sha: 'local',
      network: networkId,
      public: {
        tokenColor: config.tokenMint.tokenColor,
        derivedTokenColor: config.tokenMint.derivedTokenColor,
      },
    },
  };
  fs.writeFileSync(getDeployedConfigPath(networkId), JSON.stringify(deployed, null, 2) + '\n');
}
