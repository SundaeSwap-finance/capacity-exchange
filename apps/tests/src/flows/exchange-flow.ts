import { runExchangeFlowCore, type ExchangeFlowResult } from '../util/exchange-flow-utils.js';
import type { FlowCtxConfig } from '../util/testUtils.js';

export type { ExchangeFlowResult };
export type UnshieldedExchangeFlowResult = ExchangeFlowResult;

export async function runExchangeFlow(
  networkId: string,
  userFlowConfig: FlowCtxConfig,
  serverFlowConfig: FlowCtxConfig,
  counterAddress: string,
  cesUrl: string,
  derivedTokenColor: string
): Promise<ExchangeFlowResult> {
  return runExchangeFlowCore(
    'shielded',
    networkId,
    userFlowConfig,
    serverFlowConfig,
    counterAddress,
    cesUrl,
    derivedTokenColor
  );
}

export async function runUnshieldedExchangeFlow(
  networkId: string,
  userFlowConfig: FlowCtxConfig,
  serverFlowConfig: FlowCtxConfig,
  counterAddress: string,
  cesUrl: string,
  tokenRawId: string
): Promise<UnshieldedExchangeFlowResult> {
  return runExchangeFlowCore(
    'unshielded',
    networkId,
    userFlowConfig,
    serverFlowConfig,
    counterAddress,
    cesUrl,
    tokenRawId
  );
}
