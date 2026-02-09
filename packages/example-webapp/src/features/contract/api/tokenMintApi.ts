import type {
  StreamCallbacks,
  TokenMintDeployResult,
  TokenMintMintResult,
  TokenMintVerifyResult,
  TokenMintSendResult,
} from './types';
import { callApiWithStreaming } from './streaming';

export const tokenMintApi = {
  deploy: (networkId: string, callbacks: StreamCallbacks) =>
    callApiWithStreaming<TokenMintDeployResult>({ route: 'token-mint/deploy', networkId }, callbacks),

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

  send: (
    networkId: string,
    contractAddress: string,
    tokenColor: string,
    recipientAddress: string,
    amount: number,
    callbacks: StreamCallbacks
  ) =>
    callApiWithStreaming<TokenMintSendResult>(
      { route: 'token-mint/send', networkId, contractAddress, tokenColor, recipientAddress, amount },
      callbacks
    ),
};
