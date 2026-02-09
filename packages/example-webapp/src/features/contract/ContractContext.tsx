import React, { createContext, useContext, useState, useCallback } from 'react';

export interface CounterContract {
  contractAddress: string;
}

export interface TokenMintContract {
  contractAddress: string;
  tokenColor: string;
  derivedTokenColor: string;
  privateStateId: string;
}

interface ContractContextValue {
  counterContract: CounterContract | null;
  setCounterContract: (contract: CounterContract | null) => void;
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

interface ContractContextProviderProps {
  children: React.ReactNode;
}

export function ContractContextProvider({ children }: ContractContextProviderProps) {
  const [counterContract, setCounterContractState] = useState<CounterContract | null>(null);
  const [tokenMintContract, setTokenMintContractState] = useState<TokenMintContract | null>(null);
  const [isDeploying, setIsDeployingState] = useState(false);

  const setCounterContract = useCallback((contract: CounterContract | null) => {
    setCounterContractState(contract);
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
        counterContract,
        setCounterContract,
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
