export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StreamCallbacks {
  onLog: (text: string, stream: 'stdout' | 'stderr') => void;
}

// Counter contract types
export interface CounterDeployResult {
  contractAddress: string;
  txHash: string;
}

export interface CounterIncrementResult {
  txHash: string;
  contractAddress: string;
  blockHeight: string;
  blockHash: string;
}

export interface CounterQueryResult {
  contractAddress: string;
  round: string;
}

// Token mint contract types
export interface TokenMintDeployResult {
  contractAddress: string;
  txHash: string;
  tokenColor: string;
  derivedTokenColor: string;
  privateStateId: string;
}

export interface TokenMintMintResult {
  txHash: string;
  contractAddress: string;
  amount: string;
  derivedTokenColor: string;
  blockHeight: string;
  blockHash: string;
}

export interface TokenMintVerifyResult {
  verified: boolean;
  contractAddress: string;
  tokenColor: string;
  derivedTokenColor: string;
  balance: string;
}

export interface TokenMintSendResult {
  txHash: string;
  contractAddress: string;
  tokenColor: string;
  derivedTokenColor: string;
  amount: string;
  recipientAddress: string;
}
