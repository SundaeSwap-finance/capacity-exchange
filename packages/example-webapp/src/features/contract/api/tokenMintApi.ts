import type { StreamCallbacks, TokenMintMintResult, TokenMintVerifyResult } from './types';
import { callApiWithStreaming } from './streaming';

export const tokenMintApi = {
  mint: (
    networkId: string,
    contractAddress: string,
    privateStateId: string,
    amount: number,
    callbacks: StreamCallbacks
  ) =>
    callApiWithStreaming<TokenMintMintResult>(
      { route: 'token-mint/mint', networkId, contractAddress, privateStateId, amount },
      callbacks
    ),

  verify: (networkId: string, contractAddress: string, tokenColor: string, callbacks: StreamCallbacks) =>
    callApiWithStreaming<TokenMintVerifyResult>(
      { route: 'token-mint/verify', networkId, contractAddress, tokenColor },
      callbacks
    ),
};
