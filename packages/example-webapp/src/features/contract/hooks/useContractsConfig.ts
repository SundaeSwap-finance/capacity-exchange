import { useState, useEffect } from 'react';

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
      const response = await fetch(`/api/contracts/${networkId}`);
      const data = await response.json();

      if (data.error) {
        setState({ status: 'not-deployed' });
      } else {
        setState({ status: 'loaded', config: data as ContractsConfig });
      }
    } catch (err) {
      setState({ status: 'error', error: err instanceof Error ? err.message : 'Failed to load contracts config' });
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [networkId]);

  return { ...state, refetch: fetchConfig } as UseContractsConfigResult;
}
