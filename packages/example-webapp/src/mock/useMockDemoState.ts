import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { NetworkConfig } from '../config';
import type { ContractsConfig } from '../features/contract/hooks/useContractsConfig';
import type { UseCesTransactionResult } from '../features/ces/useCesTransaction';
import type { UseSponsoredTransactionResult } from '../features/ces/useSponsoredTransaction';
import type { ExchangePrice, CurrencySelectionResult } from '../features/ces/types';
import type { SeedWalletState } from '../features/wallet/seed/types';
import type { SyncProgressInfo } from '../features/wallet/seed/walletService';
import type { ExtensionWalletState } from '../features/wallet/extension/useExtensionWallet';
import type { WalletData, WalletInfoState } from '../features/wallet/types';
import type { UseSponsoredMintResult } from '../hooks/useSponsoredMint';

const MOCK_TOKEN_COLOR = 'mock-token-blue';
const MOCK_TOKEN_MINT_ADDRESS = 'mock-token-mint-address';
const MOCK_COUNTER_ADDRESS = 'mock-counter-address';
const MOCK_DUST_REQUIRED = 4200000n;

function mockPrice(amount: string): ExchangePrice {
  return {
    price: {
      currency: MOCK_TOKEN_COLOR,
      amount,
    },
  } as unknown as ExchangePrice;
}

export interface MockLogEvent {
  source: string;
  level: 'info' | 'success' | 'warn' | 'error';
  message: string;
}

export interface MockDemoState {
  seedWallet: SeedWalletState;
  extensionWallet: ExtensionWalletState;
  walletInfo: WalletInfoState;
  walletData: WalletData | null;
  sponsoredMint: UseSponsoredMintResult;
  cesTransaction: UseCesTransactionResult;
  sponsoredTransaction: UseSponsoredTransactionResult;
  contractsConfig: ContractsConfig;
  counterValue: string;
  isWalletConnected: boolean;
  isWalletConnecting: boolean;
  pendingLogEvents: MockLogEvent[];
  consumeLogEvents: () => void;
}

export function useMockDemoState(networkId: string, _config: NetworkConfig): MockDemoState {
  const [seedStatus, setSeedStatus] = useState<SeedWalletState['status']>('disconnected');
  const [walletInfoStatus, setWalletInfoStatus] = useState<'loading' | 'ready'>('loading');
  const [tokenBalance, setTokenBalance] = useState<bigint>(0n);
  const [counterValue, setCounterValue] = useState(7);

  const [sponsoredMintStatus, setSponsoredMintStatus] = useState<UseSponsoredMintResult['status']>('idle');
  const [sponsoredMintError, setSponsoredMintError] = useState<string | null>(null);
  const sponsoredMintInFlightRef = useRef(false);
  const sponsoredMintTimersRef = useRef<number[]>([]);

  const [cesStatus, setCesStatus] = useState<UseCesTransactionResult['status']>('idle');
  const [cesError, setCesError] = useState<string | null>(null);
  const [currencySelection, setCurrencySelection] = useState<UseCesTransactionResult['currencySelection']>(null);
  // offerConfirmation removed — auto-confirm flow

  const [sponsoredCounterStatus, setSponsoredCounterStatus] = useState<UseSponsoredTransactionResult['status']>('idle');
  const [sponsoredCounterError, setSponsoredCounterError] = useState<string | null>(null);

  const prices = useMemo(() => [mockPrice('250'), mockPrice('400')], []);

  const [pendingLogEvents, setPendingLogEvents] = useState<MockLogEvent[]>([]);
  const consumeLogEvents = useCallback(() => setPendingLogEvents([]), []);
  const pushLogEvent = useCallback((source: string, level: MockLogEvent['level'], message: string) => {
    setPendingLogEvents((prev) => [...prev, { source, level, message }]);
  }, []);

  const walletData = useMemo<WalletData | null>(() => {
    if (seedStatus !== 'connected' || walletInfoStatus !== 'ready') {
      return null;
    }

    return {
      unshieldedAddress: 'midnight_unshielded_mock_demo_001',
      shieldedAddress: 'midnight_shielded_mock_demo_001',
      dustAddress: 'midnight_dust_mock_demo_001',
      dustBalance: 25000000n,
      nightBalances: {},
      shieldedBalances: {
        [MOCK_TOKEN_COLOR]: tokenBalance,
      },
    };
  }, [seedStatus, tokenBalance, walletInfoStatus]);

  const [syncProgress, setSyncProgress] = useState<SyncProgressInfo | null>(null);
  const syncTimersRef = useRef<number[]>([]);

  const clearSyncTimers = useCallback(() => {
    syncTimersRef.current.forEach((id) => window.clearTimeout(id));
    syncTimersRef.current = [];
  }, []);

  const connectSeedWallet = useCallback(async (_seed: string) => {
    if (seedStatus !== 'disconnected') {
      return;
    }

    setSeedStatus('connecting');
    setWalletInfoStatus('loading');
    setSyncProgress(null);
    clearSyncTimers();

    const timers: number[] = [];

    // Phase 1: become "connected" after 800ms, start showing sync UI
    timers.push(window.setTimeout(() => {
      setSeedStatus('connected');
      setSyncProgress({
        shielded: { appliedIndex: 0n, targetIndex: 200n, done: false },
        dust: { appliedIndex: 0n, targetIndex: 150n, done: false },
        unshielded: false,
      });
    }, 800));

    // Phase 2: animate shielded progress over ~10s
    const shieldedSteps = [
      { delay: 2000, applied: 30n },
      { delay: 3500, applied: 75n },
      { delay: 5000, applied: 120n },
      { delay: 6500, applied: 165n },
      { delay: 8000, applied: 200n },
    ];

    for (const step of shieldedSteps) {
      timers.push(window.setTimeout(() => {
        setSyncProgress((prev) => prev && ({
          ...prev,
          shielded: {
            appliedIndex: step.applied,
            targetIndex: 200n,
            done: step.applied >= 200n,
          },
        }));
      }, step.delay));
    }

    // Phase 3: animate dust progress (starts a bit after shielded, finishes around same time)
    const dustSteps = [
      { delay: 2800, applied: 20n },
      { delay: 4500, applied: 60n },
      { delay: 6000, applied: 105n },
      { delay: 7500, applied: 150n },
    ];

    for (const step of dustSteps) {
      timers.push(window.setTimeout(() => {
        setSyncProgress((prev) => prev && ({
          ...prev,
          dust: {
            appliedIndex: step.applied,
            targetIndex: 150n,
            done: step.applied >= 150n,
          },
        }));
      }, step.delay));
    }

    // Phase 4: unshielded done
    timers.push(window.setTimeout(() => {
      setSyncProgress((prev) => prev && ({ ...prev, unshielded: true }));
    }, 9000));

    // Phase 5: mark wallet fully synced
    timers.push(window.setTimeout(() => {
      setWalletInfoStatus('ready');
    }, 10000));

    syncTimersRef.current = timers;
  }, [seedStatus, clearSyncTimers]);

  const disconnectSeedWallet = useCallback(() => {
    clearSyncTimers();
    setSeedStatus('disconnected');
    setWalletInfoStatus('loading');
    setSyncProgress(null);
    setTokenBalance(0n);
    setCounterValue(7);
  }, [clearSyncTimers]);

  const seedWallet = useMemo<SeedWalletState>(() => ({
    status: seedStatus,
    wallet: null,
    internals: null,
    error: null,
    syncProgress,
    connect: connectSeedWallet,
    disconnect: disconnectSeedWallet,
  }), [connectSeedWallet, disconnectSeedWallet, seedStatus, syncProgress]);

  const extensionWallet = useMemo<ExtensionWalletState>(() => ({
    status: 'unavailable',
    wallet: null,
    connectedAPI: null,
    error: null,
    connect: async () => {},
    disconnect: () => {},
  }), []);

  const walletInfo = useMemo<WalletInfoState>(() => {
    if (walletData) {
      return { status: 'ready', data: walletData };
    }

    return { status: 'loading' };
  }, [walletData]);

  const clearSponsoredMintTimers = useCallback(() => {
    sponsoredMintTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    sponsoredMintTimersRef.current = [];
  }, []);

  const resetSponsoredMint = useCallback(() => {
    sponsoredMintInFlightRef.current = false;
    clearSponsoredMintTimers();
    setSponsoredMintStatus('idle');
    setSponsoredMintError(null);
  }, [clearSponsoredMintTimers]);

  const mintSponsoredTokens = useCallback(async (_contractAddress: string, amount: bigint) => {
    if (sponsoredMintInFlightRef.current) {
      return;
    }

    sponsoredMintInFlightRef.current = true;
    clearSponsoredMintTimers();
    setSponsoredMintStatus('building');
    setSponsoredMintError(null);

    const timers: number[] = [];

    // 0s: building status set above
    pushLogEvent('PROOF', 'info', `compiling token-mint circuit for mint(amount=${amount})`);

    // 2s: proof witness generation
    timers.push(window.setTimeout(() => {
      pushLogEvent('PROOF', 'info', 'generating zero-knowledge witness');
    }, 2000));

    // 4.5s: proof complete, request DUST sponsorship
    timers.push(window.setTimeout(() => {
      pushLogEvent('PROOF', 'success', 'zero-knowledge proof generated');
    }, 4500));

    // 5.5s: CES sponsorship request
    timers.push(window.setTimeout(() => {
      setSponsoredMintStatus('submitting');
      pushLogEvent('CES', 'info', 'requesting DUST sponsorship from Capacity Exchange');
    }, 5500));

    // 7s: CES approved
    timers.push(window.setTimeout(() => {
      pushLogEvent('CES', 'success', 'sponsorship approved — DUST fee covered by application');
    }, 7000));

    // 8s: broadcasting
    timers.push(window.setTimeout(() => {
      pushLogEvent('TX', 'info', 'broadcasting transaction to Midnight network');
    }, 8000));

    // 10s: confirmed on chain
    timers.push(window.setTimeout(() => {
      pushLogEvent('TX', 'success', 'transaction included in block');
    }, 10000));

    // 11s: balance update observed
    timers.push(window.setTimeout(() => {
      setTokenBalance((value) => value + amount);
      setSponsoredMintStatus('success');
      sponsoredMintInFlightRef.current = false;
    }, 11000));

    sponsoredMintTimersRef.current = timers;
  }, [clearSponsoredMintTimers, pushLogEvent]);

  useEffect(() => () => {
    clearSyncTimers();
    clearSponsoredMintTimers();
  }, [clearSyncTimers, clearSponsoredMintTimers]);

  const sponsoredMint = useMemo<UseSponsoredMintResult>(() => ({
    status: sponsoredMintStatus,
    error: sponsoredMintError,
    mint: mintSponsoredTokens,
    reset: resetSponsoredMint,
  }), [mintSponsoredTokens, resetSponsoredMint, sponsoredMintError, sponsoredMintStatus]);

  const dismissCesOffer = useCallback(() => {
    setCesStatus('idle');
    setCesError(null);
    setCurrencySelection(null);
  }, []);

  const incrementCesCounter = useCallback(async () => {
    setCesStatus('building');
    setCesError(null);
    pushLogEvent('PROOF', 'info', 'compiling counter circuit for increment()');

    window.setTimeout(() => {
      pushLogEvent('PROOF', 'success', 'zero-knowledge proof generated');
      pushLogEvent('CES', 'info', 'fetching DUST exchange rates from Capacity Exchange');
      setCesStatus('selecting-currency');
      setCurrencySelection({ prices, specksRequired: MOCK_DUST_REQUIRED });
    }, 2500);
  }, [prices, pushLogEvent]);

  const onCurrencySelected = useCallback((result: CurrencySelectionResult) => {
    if (result.status !== 'selected') {
      dismissCesOffer();
      return;
    }

    setCurrencySelection(null);
    setCesStatus('fetching-offers');
    pushLogEvent('CES', 'info', `requesting live capacity exchange quote for ${result.exchangePrice.price.amount} tokens`);

    window.setTimeout(() => {
      pushLogEvent('CES', 'success', 'exchange offer received — auto-confirming');
      setCesStatus('submitting');
      pushLogEvent('TX', 'info', 'broadcasting exchange + counter increment to Midnight network');

      window.setTimeout(() => {
        pushLogEvent('TX', 'success', 'transaction included in block');
      }, 2000);

      window.setTimeout(() => {
        setTokenBalance((value) => (value >= 250n ? value - 250n : value));
        setCounterValue((value) => value + 1);
        setCesStatus('success');
      }, 3500);
    }, 1500);
  }, [dismissCesOffer, pushLogEvent]);

  const cesTransaction = useMemo<UseCesTransactionResult>(() => ({
    status: cesStatus,
    error: cesError,
    currencySelection,
    onCurrencySelected,
    dismissOffer: dismissCesOffer,
    incrementCounter: incrementCesCounter,
  }), [
    cesError,
    cesStatus,
    currencySelection,
    dismissCesOffer,
    incrementCesCounter,
    onCurrencySelected,
  ]);

  const dismissSponsoredCounter = useCallback(() => {
    setSponsoredCounterStatus('idle');
    setSponsoredCounterError(null);
  }, []);

  const incrementSponsoredCounter = useCallback(async () => {
    setSponsoredCounterStatus('building');
    setSponsoredCounterError(null);
    pushLogEvent('PROOF', 'info', 'compiling counter circuit for sponsored increment()');

    window.setTimeout(() => {
      pushLogEvent('PROOF', 'success', 'zero-knowledge proof generated');
      setSponsoredCounterStatus('submitting');
      pushLogEvent('CES', 'info', 'requesting DUST sponsorship from Capacity Exchange');
    }, 3000);

    window.setTimeout(() => {
      pushLogEvent('CES', 'success', 'sponsorship approved — DUST fee covered');
      pushLogEvent('TX', 'info', 'broadcasting transaction to Midnight network');
    }, 4500);

    window.setTimeout(() => {
      pushLogEvent('TX', 'success', 'transaction included in block');
      setCounterValue((value) => value + 1);
      setSponsoredCounterStatus('success');
    }, 6500);
  }, [pushLogEvent]);

  const sponsoredTransaction = useMemo<UseSponsoredTransactionResult>(() => ({
    status: sponsoredCounterStatus,
    error: sponsoredCounterError,
    incrementCounter: incrementSponsoredCounter,
    dismiss: dismissSponsoredCounter,
  }), [dismissSponsoredCounter, incrementSponsoredCounter, sponsoredCounterError, sponsoredCounterStatus]);

  const contractsConfig = useMemo<ContractsConfig>(() => ({
    networkId,
    tokenMint: {
      contractAddress: MOCK_TOKEN_MINT_ADDRESS,
      txHash: 'mock-token-mint-tx',
      tokenColor: MOCK_TOKEN_COLOR,
      derivedTokenColor: MOCK_TOKEN_COLOR,
      privateStateId: 'mock-private-state-id',
    },
    counter: {
      contractAddress: MOCK_COUNTER_ADDRESS,
      txHash: 'mock-counter-tx',
    },
  }), [networkId]);

  return {
    seedWallet,
    extensionWallet,
    walletInfo,
    walletData,
    sponsoredMint,
    cesTransaction,
    sponsoredTransaction,
    contractsConfig,
    counterValue: String(counterValue),
    isWalletConnected: seedStatus === 'connected',
    isWalletConnecting: seedStatus === 'connecting',
    pendingLogEvents,
    consumeLogEvents,
  };
}
