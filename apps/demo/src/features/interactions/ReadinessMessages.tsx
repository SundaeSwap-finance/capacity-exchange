import React from 'react';
import { Copyable, LoadingSpinner, Message } from '../../shared/ui';
import type { WalletInfoState } from '../wallet/types';
import type { CesReadiness } from './useCesReadiness';

interface ReadinessMessagesProps {
  walletConnected: boolean;
  walletInfo: WalletInfoState;
  cesReadiness: CesReadiness;
  contractAddress: string | null;
  tokenColor: string | null;
  hasTokenBalance: boolean;
}

function getWalletMessages(walletConnected: boolean, walletInfo: WalletInfoState): React.ReactNode[] {
  if (!walletConnected) {
    return [
      <Message key="wallet-connect" variant="warn">
        Connect a wallet to interact with contracts.
      </Message>,
    ];
  }
  if (walletInfo.status === 'loading') {
    return [<LoadingSpinner key="wallet-loading" message="Loading wallet info..." />];
  }
  if (walletInfo.status === 'error') {
    return [
      <Message key="wallet-error" variant="error">
        {walletInfo.error}
      </Message>,
    ];
  }
  return [];
}

function getContractMessages(contractAddress: string | null): React.ReactNode[] {
  if (!contractAddress) {
    return [
      <Message key="contract" variant="warn">
        Deploy a counter contract first.
      </Message>,
    ];
  }
  return [];
}

function getCesMessages(cesReadiness: CesReadiness, tokenColor: string | null): React.ReactNode[] {
  if (cesReadiness.status === 'loading') {
    return [<LoadingSpinner key="ces-loading" message="Checking Capacity Exchange Service..." />];
  }
  if (cesReadiness.status === 'offline') {
    return [
      <Message key="ces-offline" variant="error">
        Capacity Exchange Service is offline: {cesReadiness.error}
      </Message>,
    ];
  }
  if (cesReadiness.status === 'syncing') {
    return [
      <Message key="ces-syncing" variant="warn">
        Capacity Exchange Service is syncing. Please wait.
      </Message>,
    ];
  }
  if (cesReadiness.status === 'ready' && !cesReadiness.hasCurrency && tokenColor) {
    return [
      <Message key="ces-currency" variant="warn">
        Token color not found in CES currencies. Add it to{' '}
        <code className="bg-black/30 px-1 rounded">price-formulas.json</code> and restart the CES.
        <br />
        Token color: <Copyable text={tokenColor} />
      </Message>,
    ];
  }
  return [];
}

function getTokenBalanceMessages(
  walletConnected: boolean,
  walletInfo: WalletInfoState,
  hasTokenBalance: boolean,
  contractAddress: string | null
): React.ReactNode[] {
  if (walletConnected && walletInfo.status === 'ready' && !hasTokenBalance && contractAddress) {
    return [
      <Message key="token-balance" variant="warn">
        Your wallet has no tokens of this color. Mint and send tokens using Contract Operations.
      </Message>,
    ];
  }
  return [];
}

export function ReadinessMessages({
  walletConnected,
  walletInfo,
  cesReadiness,
  contractAddress,
  tokenColor,
  hasTokenBalance,
}: ReadinessMessagesProps) {
  const messages = [
    ...getWalletMessages(walletConnected, walletInfo),
    ...getContractMessages(contractAddress),
    ...getCesMessages(cesReadiness, tokenColor),
    ...getTokenBalanceMessages(walletConnected, walletInfo, hasTokenBalance, contractAddress),
  ];

  if (messages.length === 0) {
    return null;
  }

  return <div className="space-y-2">{messages}</div>;
}
