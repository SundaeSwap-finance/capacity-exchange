import { useEffect } from 'react';
import { useContractContext } from '../ContractContext';
import type { ContractsConfig } from '../hooks/useContractsConfig';

export function useSyncContractContext(loadedConfig: ContractsConfig | null) {
  const { setCounterContract, setTokenMintContract } = useContractContext();

  useEffect(() => {
    if (loadedConfig) {
      setCounterContract({ contractAddress: loadedConfig.counter.contractAddress });
      setTokenMintContract({
        contractAddress: loadedConfig.tokenMint.contractAddress,
        tokenColor: loadedConfig.tokenMint.tokenColor,
        derivedTokenColor: loadedConfig.tokenMint.derivedTokenColor,
        privateStateId: loadedConfig.tokenMint.privateStateId,
      });
    } else {
      setCounterContract(null);
      setTokenMintContract(null);
    }
  }, [loadedConfig, setCounterContract, setTokenMintContract]);
}
