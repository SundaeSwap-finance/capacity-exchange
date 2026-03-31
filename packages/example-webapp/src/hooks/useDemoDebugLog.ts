import { useEffect, useRef, useState } from 'react';
import type { CesFlowStatus, CurrencySelectionState, OfferConfirmationState } from '../features/ces/types';
import type { SponsoredFlowStatus } from '../features/ces/useSponsoredTransaction';
import type { WalletInfoState } from '../features/wallet/types';
import type { SponsoredMintStatus } from './useSponsoredMint';
import type { Substep, TutorialStep } from './useTutorialState';
import type { MockLogEvent } from '../mock/useMockDemoState';

export interface DebugLogEntry {
  id: number;
  timestamp: string;
  source: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

interface UseDemoDebugLogArgs {
  step: TutorialStep;
  substep: Substep;
  networkId: string;
  modeLabel: string;
  walletConnecting: boolean;
  walletConnected: boolean;
  walletInfoState: WalletInfoState;
  sponsoredMintStatus: SponsoredMintStatus;
  sponsoredMintError: string | null;
  cesStatus: CesFlowStatus;
  cesError: string | null;
  currencySelection: CurrencySelectionState | null;
  offerConfirmation: OfferConfirmationState | null;
  sponsoredTransactionStatus: SponsoredFlowStatus;
  sponsoredTransactionError: string | null;
  tokenBalance: bigint;
  counterValue: string | null;
  pendingLogEvents?: MockLogEvent[];
  consumeLogEvents?: () => void;
}

const MAX_LOG_ENTRIES = 18;

function nowLabel() {
  return new Date().toLocaleTimeString([], {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function stepName(step: TutorialStep, _substep: Substep) {
  if (step === 0) {return 'wallet';}
  if (step === 1) {return 'sponsored-mint';}
  if (step === 2) {return 'register-submit';}
  return 'playground';
}

export function useDemoDebugLog({
  step,
  substep,
  networkId,
  modeLabel,
  walletConnecting,
  walletConnected,
  walletInfoState,
  sponsoredMintStatus,
  sponsoredMintError,
  cesStatus,
  cesError,
  currencySelection,
  offerConfirmation,
  sponsoredTransactionStatus,
  sponsoredTransactionError,
  tokenBalance,
  counterValue,
  pendingLogEvents,
  consumeLogEvents,
}: UseDemoDebugLogArgs): DebugLogEntry[] {
  const nextIdRef = useRef(3);
  const prevStepRef = useRef(`${step}-${substep}`);
  const prevWalletConnectingRef = useRef(walletConnecting);
  const prevWalletConnectedRef = useRef(walletConnected);
  const prevWalletInfoRef = useRef(walletInfoState.status);
  const prevSponsoredMintStatusRef = useRef(sponsoredMintStatus);
  const prevSponsoredMintErrorRef = useRef(sponsoredMintError);
  const prevCesStatusRef = useRef(cesStatus);
  const prevCesErrorRef = useRef(cesError);
  const prevCurrencySelectionRef = useRef<CurrencySelectionState | null>(currencySelection);
  const prevOfferConfirmationRef = useRef<OfferConfirmationState | null>(offerConfirmation);
  const prevSponsoredTxnStatusRef = useRef(sponsoredTransactionStatus);
  const prevSponsoredTxnErrorRef = useRef(sponsoredTransactionError);
  const prevTokenBalanceRef = useRef(tokenBalance);
  const prevCounterValueRef = useRef(counterValue);

  const [entries, setEntries] = useState<DebugLogEntry[]>([
    {
      id: 0,
      timestamp: nowLabel(),
      source: 'SYS',
      level: 'info',
      message: `${modeLabel.toLowerCase()} session initialized`,
    },
    {
      id: 1,
      timestamp: nowLabel(),
      source: 'NET',
      level: 'info',
      message: `network=${networkId} step=${stepName(step, substep)}`,
    },
    {
      id: 2,
      timestamp: nowLabel(),
      source: 'DUST',
      level: 'warn',
      message: 'Midnight transactions require DUST; Capacity Exchange is demonstrating how to abstract that dependency',
    },
  ]);

  const appendEntry = (source: string, level: DebugLogEntry['level'], message: string) => {
    setEntries((current) => [
      {
        id: nextIdRef.current++,
        timestamp: nowLabel(),
        source,
        level,
        message,
      },
      ...current,
    ].slice(0, MAX_LOG_ENTRIES));
  };

  // Consume mock log events pushed by the mock state
  useEffect(() => {
    if (!pendingLogEvents || pendingLogEvents.length === 0) {return;}
    for (const event of pendingLogEvents) {
      appendEntry(event.source, event.level, event.message);
    }
    consumeLogEvents?.();
  }, [pendingLogEvents]);

  useEffect(() => {
    const currentStepKey = `${step}-${substep}`;
    if (prevStepRef.current !== currentStepKey) {
      appendEntry('FLOW', 'info', `step=${stepName(step, substep)}`);
      if (step === 1 && substep === 'b') {
        appendEntry('FLOW', 'info', 'sponsored mint flow initialized');
      }
      if (step === 2 && substep === 'b') {
        appendEntry('FLOW', 'info', 'paid exchange flow initialized');
      }
      if (step === 3) {
        appendEntry('FLOW', 'info', 'playground ready');
      }
      prevStepRef.current = currentStepKey;
    }
  }, [step, substep]);

  useEffect(() => {
    if (!prevWalletConnectingRef.current && walletConnecting) {
      appendEntry('WAL', 'info', 'wallet connection requested');
    }
    prevWalletConnectingRef.current = walletConnecting;
  }, [walletConnecting]);

  useEffect(() => {
    if (!prevWalletConnectedRef.current && walletConnected) {
      appendEntry('WAL', 'success', 'wallet connected');
    }
    prevWalletConnectedRef.current = walletConnected;
  }, [walletConnected]);

  useEffect(() => {
    if (prevWalletInfoRef.current !== walletInfoState.status) {
      if (walletInfoState.status === 'loading' && walletConnected) {
        appendEntry('SYNC', 'info', 'syncing wallet balances and DUST context');
      }
      if (walletInfoState.status === 'ready') {
        appendEntry('SYNC', 'success', 'wallet sync complete');
      }
      prevWalletInfoRef.current = walletInfoState.status;
    }
  }, [walletConnected, walletInfoState.status]);

  useEffect(() => {
    if (prevSponsoredMintStatusRef.current !== sponsoredMintStatus) {
      if (sponsoredMintStatus === 'building') {
        appendEntry('PROOF', 'info', 'initiating sponsored mint — building zero-knowledge proof');
      } else if (sponsoredMintStatus === 'submitting') {
        appendEntry('CES', 'info', 'proof complete — requesting DUST sponsorship');
      } else if (sponsoredMintStatus === 'idle' && prevSponsoredMintStatusRef.current !== 'idle') {
        appendEntry('FLOW', 'info', 'sponsored mint flow reset');
      }
      prevSponsoredMintStatusRef.current = sponsoredMintStatus;
    }
  }, [sponsoredMintStatus]);

  useEffect(() => {
    if (sponsoredMintError && prevSponsoredMintErrorRef.current !== sponsoredMintError) {
      appendEntry('TX', 'error', sponsoredMintError);
      prevSponsoredMintErrorRef.current = sponsoredMintError;
    }
  }, [sponsoredMintError]);

  useEffect(() => {
    if (step === 1 && substep === 'b' && sponsoredMintStatus === 'idle') {
      appendEntry('FLOW', 'info', 'sponsored mint ready — awaiting user action');
    }
  }, [step, substep, sponsoredMintStatus]);

  useEffect(() => {
    if (prevCesStatusRef.current !== cesStatus) {
      if (cesStatus === 'building') {
        appendEntry('PROOF', 'info', 'building zero-knowledge proof for counter increment');
      } else if (cesStatus === 'selecting-currency') {
        appendEntry('CES', 'info', 'DUST requirement priced — awaiting token selection');
      } else if (cesStatus === 'fetching-offers') {
        appendEntry('CES', 'info', 'requesting live capacity exchange quote');
      } else if (cesStatus === 'confirming') {
        appendEntry('CES', 'success', 'exchange offer received — awaiting user confirmation');
      } else if (cesStatus === 'submitting') {
        appendEntry('TX', 'info', 'submitting exchange + counter transaction to network');
      } else if (cesStatus === 'idle' && prevCesStatusRef.current !== 'idle') {
        appendEntry('FLOW', 'info', 'exchange flow reset');
      }
      prevCesStatusRef.current = cesStatus;
    }
  }, [cesStatus]);

  useEffect(() => {
    if (cesError && prevCesErrorRef.current !== cesError) {
      appendEntry('TX', 'error', cesError);
      prevCesErrorRef.current = cesError;
    }
  }, [cesError]);

  useEffect(() => {
    if (prevCurrencySelectionRef.current !== currencySelection) {
      if (currencySelection) {
        appendEntry(
          'CES',
          'info',
          `exchange quotes ready quotes=${currencySelection.prices.length} dust_specks=${currencySelection.specksRequired.toString()}`
        );
      } else if (prevCurrencySelectionRef.current) {
        appendEntry('CES', 'info', 'currency selection dismissed');
      }
      prevCurrencySelectionRef.current = currencySelection;
    }
  }, [currencySelection]);

  useEffect(() => {
    if (prevOfferConfirmationRef.current !== offerConfirmation) {
      if (offerConfirmation) {
        const expiresInMs = offerConfirmation.offer.expiresAt.getTime() - Date.now();
        const expiresInSec = Math.max(0, Math.round(expiresInMs / 1000));
        appendEntry(
          'CES',
          'info',
          `offer locked amount=${offerConfirmation.offer.offerAmount} currency=${offerConfirmation.offer.offerCurrency} expires_in=${expiresInSec}s`
        );
      } else if (prevOfferConfirmationRef.current) {
        appendEntry('CES', 'info', 'offer dismissed');
      }
      prevOfferConfirmationRef.current = offerConfirmation;
    }
  }, [offerConfirmation]);

  useEffect(() => {
    if (step === 2 && substep === 'b' && cesStatus === 'idle') {
      appendEntry('FLOW', 'info', 'paid exchange ready — awaiting user action');
    }
  }, [step, substep, cesStatus]);

  useEffect(() => {
    if (prevSponsoredTxnStatusRef.current !== sponsoredTransactionStatus) {
      if (sponsoredTransactionStatus === 'building') {
        appendEntry('PROOF', 'info', 'building zero-knowledge proof for sponsored counter increment');
      } else if (sponsoredTransactionStatus === 'submitting') {
        appendEntry('TX', 'info', 'submitting sponsored transaction to Midnight network');
      } else if (sponsoredTransactionStatus === 'idle' && prevSponsoredTxnStatusRef.current !== 'idle') {
        appendEntry('FLOW', 'info', 'sponsored transaction reset');
      }
      prevSponsoredTxnStatusRef.current = sponsoredTransactionStatus;
    }
  }, [sponsoredTransactionStatus]);

  useEffect(() => {
    if (sponsoredTransactionError && prevSponsoredTxnErrorRef.current !== sponsoredTransactionError) {
      appendEntry('TX', 'error', sponsoredTransactionError);
      prevSponsoredTxnErrorRef.current = sponsoredTransactionError;
    }
  }, [sponsoredTransactionError]);

  useEffect(() => {
    if (tokenBalance > prevTokenBalanceRef.current) {
      const delta = tokenBalance - prevTokenBalanceRef.current;
      appendEntry('CHAIN', 'success', `wallet observed token balance increase of ${delta.toString()} to ${tokenBalance.toString()}`);
    }
    prevTokenBalanceRef.current = tokenBalance;
  }, [tokenBalance]);

  useEffect(() => {
    const previous = prevCounterValueRef.current ? Number(prevCounterValueRef.current) : null;
    const current = counterValue ? Number(counterValue) : null;

    if (previous !== null && current !== null && current > previous) {
      appendEntry('CHAIN', 'success', `contract state observed registration counter advance to ${counterValue}`);
    }

    prevCounterValueRef.current = counterValue;
  }, [counterValue]);

  return entries;
}
