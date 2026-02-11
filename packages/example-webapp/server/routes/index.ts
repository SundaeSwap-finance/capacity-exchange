import type { RequestBody, ScriptConfig } from '../types.js';

export function getScriptConfig(body: RequestBody): ScriptConfig {
  switch (body.route) {
    case 'counter/deploy':
      return {
        script: 'src/counter/cli/deploy.ts',
        args: [body.networkId],
      };
    case 'counter/increment':
      return {
        script: 'src/counter/cli/increment.ts',
        args: [body.networkId, body.contractAddress],
      };
    case 'counter/query':
      return {
        script: 'src/counter/cli/query.ts',
        args: [body.networkId, body.contractAddress],
      };
    case 'token-mint/deploy':
      return {
        script: 'src/token-mint/cli/deploy.ts',
        args: body.tokenColor ? [body.networkId, body.tokenColor] : [body.networkId],
      };
    case 'token-mint/mint':
      return {
        script: 'src/token-mint/cli/mint.ts',
        args: [body.networkId, body.contractAddress, body.privateStateId, String(body.amount)],
      };
    case 'token-mint/verify':
      return {
        script: 'src/token-mint/cli/verify.ts',
        args: [body.networkId, body.contractAddress, body.tokenColor],
      };
    case 'token-mint/send':
      return {
        script: 'src/token-mint/cli/send.ts',
        args: [body.networkId, body.contractAddress, body.tokenColor, body.recipientAddress, String(body.amount)],
      };
  }
}
