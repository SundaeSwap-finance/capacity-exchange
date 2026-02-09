interface CounterDeployBody {
  route: 'counter/deploy';
  networkId: string;
}

interface CounterIncrementBody {
  route: 'counter/increment';
  networkId: string;
  contractAddress: string;
}

interface CounterQueryBody {
  route: 'counter/query';
  networkId: string;
  contractAddress: string;
}

interface TokenMintDeployBody {
  route: 'token-mint/deploy';
  networkId: string;
  tokenColor?: string;
}

interface TokenMintMintBody {
  route: 'token-mint/mint';
  networkId: string;
  contractAddress: string;
  privateStateId: string;
  amount: number;
}

interface TokenMintVerifyBody {
  route: 'token-mint/verify';
  networkId: string;
  contractAddress: string;
  tokenColor: string;
}

interface TokenMintSendBody {
  route: 'token-mint/send';
  networkId: string;
  contractAddress: string;
  tokenColor: string;
  recipientAddress: string;
  amount: number;
}

export type RequestBody =
  | CounterDeployBody
  | CounterIncrementBody
  | CounterQueryBody
  | TokenMintDeployBody
  | TokenMintMintBody
  | TokenMintVerifyBody
  | TokenMintSendBody;

export interface ScriptConfig {
  script: string;
  args: string[];
}
