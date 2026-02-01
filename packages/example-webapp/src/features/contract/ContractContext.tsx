import React, { createContext, useContext, useState, useCallback } from 'react';

export interface TokenMintContract {
  contractAddress: string;
  tokenColor: string;
  derivedTokenColor: string;
  privateStateId: string;
}

interface ContractContextValue {
  counterContractAddress: string | null;
  setCounterContractAddress: (address: string | null) => void;
  tokenMintContract: TokenMintContract | null;
  setTokenMintContract: (contract: TokenMintContract | null) => void;
  isDeploying: boolean;
  setIsDeploying: (deploying: boolean) => void;
}

const ContractContext = createContext<ContractContextValue | null>(null);

export function useContractContext(): ContractContextValue {
  const context = useContext(ContractContext);
  if (!context) {
    throw new Error('useContractContext must be used within a ContractContextProvider');
  }
  return context;
}

export function useContractContextOptional(): ContractContextValue | null {
  return useContext(ContractContext);
}

interface ContractContextProviderProps {
  children: React.ReactNode;
}

export function ContractContextProvider({ children }: ContractContextProviderProps) {
  const [counterContractAddress, setCounterContractAddressState] = useState<string | null>(null);
  const [tokenMintContract, setTokenMintContractState] = useState<TokenMintContract | null>(null);
  const [isDeploying, setIsDeployingState] = useState(false);

  const setCounterContractAddress = useCallback((address: string | null) => {
    setCounterContractAddressState(address);
  }, []);

  const setTokenMintContract = useCallback((contract: TokenMintContract | null) => {
    setTokenMintContractState(contract);
  }, []);

  const setIsDeploying = useCallback((deploying: boolean) => {
    setIsDeployingState(deploying);
  }, []);

  return (
    <ContractContext.Provider
      value={{
        counterContractAddress,
        setCounterContractAddress,
        tokenMintContract,
        setTokenMintContract,
        isDeploying,
        setIsDeploying,
      }}
    >
      {children}
    </ContractContext.Provider>
  );
}
