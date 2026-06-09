import { useState, useEffect } from 'react';
import type { ContractDeployRecord, DeployedContracts } from '@capacity-exchange/archive-tools/read';

export interface TokenMintConfig {
  contractAddress: string;
  txHash: string;
  tokenColor: string;
  derivedTokenColor: string;
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

function requirePublicString(record: ContractDeployRecord, contractName: string, field: string): string {
  const v = record.public[field];
  if (typeof v !== 'string') {
    throw new Error(`${contractName} deploy record missing string field 'public.${field}' (got ${typeof v})`);
  }
  return v;
}

function toContractsConfig(deployed: DeployedContracts): ContractsConfig {
  const tokenMint = deployed['token-mint'];
  return {
    networkId: deployed.network,
    tokenMint: {
      contractAddress: tokenMint.address,
      txHash: tokenMint.txHash,
      tokenColor: requirePublicString(tokenMint, 'token-mint', 'tokenColor'),
      derivedTokenColor: requirePublicString(tokenMint, 'token-mint', 'derivedTokenColor'),
    },
    counter: {
      contractAddress: deployed.counter.address,
      txHash: deployed.counter.txHash,
    },
  };
}

export type UseContractsConfigResult =
  | { status: 'loading'; refetch: () => void }
  | { status: 'not-deployed'; refetch: () => void }
  | { status: 'error'; error: string; refetch: () => void }
  | { status: 'loaded'; config: ContractsConfig; refetch: () => void };

type InternalState =
  | { status: 'loading' }
  | { status: 'not-deployed' }
  | { status: 'error'; error: string }
  | { status: 'loaded'; config: ContractsConfig };

export function useContractsConfig(networkId: string): UseContractsConfigResult {
  const [state, setState] = useState<InternalState>({ status: 'loading' });

  const fetchConfig = async () => {
    setState({ status: 'loading' });
    try {
      const response = await fetch('/contracts.json');
      if (response.status === 404) {
        setState({ status: 'not-deployed' });
        return;
      }
      if (!response.ok) {
        setState({ status: 'error', error: `HTTP ${response.status}` });
        return;
      }
      const contentType = response.headers.get('content-type') ?? '';
      if (!contentType.includes('application/json')) {
        setState({ status: 'not-deployed' });
        return;
      }
      const data = (await response.json()) as DeployedContracts;
      if (data.network !== networkId) {
        setState({
          status: 'error',
          error: `contracts.json network '${data.network}' does not match expected '${networkId}'`,
        });
        return;
      }
      setState({ status: 'loaded', config: toContractsConfig(data) });
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : 'Failed to load contracts config' });
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [networkId]);

  return { ...state, refetch: fetchConfig } as UseContractsConfigResult;
}
