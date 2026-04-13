import { useEffect, useRef } from 'react';
import { NarrativeCard } from '../components/NarrativeCard';
import { RotatingStatusText } from '../components/RotatingStatusText';
import { CounterCard } from '../components/CounterCard';
import { TokenBalanceCard } from '../components/TokenBalanceCard';
import { TransactionProgress } from '../components/TransactionProgress';
import { formatDust } from '../utils/format';
import type { WalletData } from '../features/wallet/types';
import type { UseCesTransactionResult } from '../features/ces/useCesTransaction';
import type { ExchangePrice, CurrencySelectionResult } from '../features/ces/types';
import { resolveTokenLabel } from '../utils/tokenLabels';

interface PaidExchangeStepProps {
  walletData: WalletData | null;
  cesTransaction: UseCesTransactionResult;
  counterValue: string | null;
  mintedTokenColor: string | null;
  onCesSuccess: () => void;
  hasGraduated?: boolean;
  onSkipToPlayground?: () => void;
}

function getTokenBalance(walletData: WalletData | null): bigint {
  if (!walletData) {
    return 0n;
  }
  const balances = Object.values(walletData.shieldedBalances);
  return balances.length > 0 ? balances.reduce((a, b) => a + b, 0n) : 0n;
}

function InventoryStrip({
  counterValue,
  walletData,
  freeze,
}: {
  counterValue: string | null;
  walletData: WalletData | null;
  freeze?: boolean;
}) {
  const tokenBalance = getTokenBalance(walletData);
  if (counterValue === null && tokenBalance === 0n) {
    return null;
  }

  return (
    <div className="ces-inventory-grid">
      <CounterCard value={counterValue} freeze={freeze} />
      <TokenBalanceCard balance={tokenBalance} tokenLabel="Tutorial Tokens" />
    </div>
  );
}

export function PaidExchangeStep({
  walletData,
  cesTransaction,
  counterValue,
  mintedTokenColor,
  onCesSuccess,
  hasGraduated = false,
  onSkipToPlayground,
}: PaidExchangeStepProps) {
  return (
    <CesCounterAction
      cesTransaction={cesTransaction}
      walletData={walletData}
      counterValue={counterValue}
      mintedTokenColor={mintedTokenColor}
      onSuccess={onCesSuccess}
      hasGraduated={hasGraduated}
      onSkipToPlayground={onSkipToPlayground}
    />
  );
}

function CesCounterAction({
  cesTransaction,
  walletData,
  counterValue,
  mintedTokenColor,
  onSuccess,
  hasGraduated,
  onSkipToPlayground,
}: {
  cesTransaction: UseCesTransactionResult;
  walletData: WalletData | null;
  counterValue: string | null;
  mintedTokenColor: string | null;
  onSuccess: () => void;
  hasGraduated: boolean;
  onSkipToPlayground?: () => void;
}) {
  const { status, error, currencySelection, onCurrencySelected, incrementCounter, dismissOffer } = cesTransaction;

  const isTransacting = !['idle', 'success', 'error'].includes(status);

  // Freeze the displayed balance while a transaction is in flight so the
  // wallet SDK's optimistic deduction doesn't confuse the user.
  const frozenWalletDataRef = useRef<WalletData | null>(null);
  useEffect(() => {
    if (isTransacting && !frozenWalletDataRef.current) {
      frozenWalletDataRef.current = walletData;
    } else if (!isTransacting) {
      frozenWalletDataRef.current = null;
    }
  }, [isTransacting, walletData]);
  const displayWalletData = frozenWalletDataRef.current ?? walletData;

  const progressSteps = [
    {
      label: 'Prepare private registration payload',
      status: (status === 'building'
        ? 'active'
        : ['selecting-currency', 'fetching-offers', 'submitting', 'success'].includes(status)
          ? 'done'
          : 'waiting') as 'active' | 'done' | 'waiting',
    },
    {
      label: 'Choose asset to satisfy DUST',
      status: (status === 'selecting-currency'
        ? 'input'
        : ['fetching-offers', 'submitting', 'success'].includes(status)
          ? 'done'
          : 'waiting') as 'active' | 'input' | 'done' | 'waiting',
    },
    {
      label: 'Exchange & submit',
      status: (status === 'fetching-offers' || status === 'submitting'
        ? 'active'
        : status === 'success'
          ? 'done'
          : 'waiting') as 'active' | 'done' | 'waiting',
    },
  ];

  return (
    <div className="ces-step-stack">
      <NarrativeCard heading="Register Graduation" variant="accent">
        <p>However, dApps may not always be willing to cover every transaction.</p>
        <p>
          The Capacity Exchange also lets users pay with <strong className="text-ces-text">any other asset</strong>{' '}
          accepted by the market.
        </p>
        <p>
          Let&apos;s complete the tutorial by registering that you've finished the tutorial, and paying the transaction
          fees with the tutorial tokens you just minted.
        </p>
      </NarrativeCard>

      <InventoryStrip counterValue={counterValue} walletData={displayWalletData} freeze={isTransacting} />

      {status === 'idle' && (
        <>
          <button onClick={incrementCounter} className="ces-btn-primary w-full">
            Complete Tutorial (Pay with Tutorial Tokens)
          </button>
          {hasGraduated && onSkipToPlayground && (
            <button onClick={onSkipToPlayground} className="ces-btn-ghost w-full">
              Skip to playground
            </button>
          )}
        </>
      )}

      {status !== 'idle' && status !== 'success' && status !== 'error' && (
        <div className="ces-card ces-section-stack">
          <TransactionProgress steps={progressSteps} />

          {status === 'selecting-currency' && currencySelection && (
            <InlineCurrencySelection
              prices={currencySelection.prices}
              specksRequired={currencySelection.specksRequired}
              shieldedBalances={displayWalletData?.shieldedBalances ?? {}}
              mintedTokenColor={mintedTokenColor}
              onSelect={onCurrencySelected}
            />
          )}

          {status === 'building' && (
            <RotatingStatusText
              active
              messages={[
                'Building the private registration transaction.',
                'The app is calculating how much DUST this contract action requires.',
                'Once that is ready, you can choose which asset to pay with.',
              ]}
            />
          )}

          {status === 'fetching-offers' && (
            <RotatingStatusText
              active
              messages={[
                'Requesting a live Capacity Exchange quote for the DUST requirement.',
                'The app is checking what the selected asset will cost for this registration.',
                'This is where youselect an asset and a DUST liquidity provider.',
              ]}
            />
          )}

          {status === 'submitting' && (
            <RotatingStatusText
              active
              messages={[
                'Submitting the transaction to Midnight now.',
                'Waiting for the transaction to be included in a block.',
                'When this completes, the tutorial will be marked complete!',
              ]}
            />
          )}
        </div>
      )}

      {status === 'success' && (
        <div className="ces-card text-center py-6">
          <div className="w-12 h-12 rounded-full bg-ces-accent/20 flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 text-ces-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-ces-text font-display font-semibold text-lg">Registration Complete</p>
          <p className="mt-1 text-sm text-ces-text-muted">You completed the tutorial without ever requiring DUST.</p>
          <button onClick={onSuccess} className="ces-btn-primary mt-4">
            Continue to Playground
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="ces-card ces-section-stack">
          <div className="p-3 rounded-lg bg-ces-danger/10 border border-ces-danger/20 text-ces-danger text-sm">
            {error}
          </div>
          <button onClick={dismissOffer} className="ces-btn-secondary w-full">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}

function InlineCurrencySelection({
  prices,
  specksRequired,
  shieldedBalances,
  mintedTokenColor,
  onSelect,
}: {
  prices: ExchangePrice[];
  specksRequired: bigint;
  shieldedBalances: Record<string, bigint>;
  mintedTokenColor: string | null;
  onSelect: (result: CurrencySelectionResult) => void;
}) {
  const sortedPrices = [...prices].sort((a, b) => {
    const balA = shieldedBalances[a.price.currency.rawId] ?? 0n;
    const balB = shieldedBalances[b.price.currency.rawId] ?? 0n;
    const canAffordA = balA >= BigInt(a.price.amount);
    const canAffordB = balB >= BigInt(b.price.amount);
    if (canAffordA && !canAffordB) {
      return -1;
    }
    if (!canAffordA && canAffordB) {
      return 1;
    }
    return 0;
  });

  return (
    <div className="ces-compact-stack ces-input-pulse">
      <p className="text-sm text-ces-text">
        This transaction needs <span className="text-ces-text font-mono">{formatDust(specksRequired)}</span> DUST (
        <span className="font-mono">{specksRequired.toString()}</span> specks). Pick which accepted asset should cover
        it:
      </p>
      {sortedPrices.map((ep, i) => {
        const balance = shieldedBalances[ep.price.currency.rawId] ?? 0n;
        const cost = BigInt(ep.price.amount);
        const canAfford = balance >= cost;
        const token = resolveTokenLabel(ep.price.currency, mintedTokenColor);

        return (
          <button
            key={`${ep.price.currency}-${i}`}
            onClick={() => onSelect({ status: 'selected', exchangePrice: ep })}
            disabled={!canAfford}
            className={`w-full p-3 rounded-lg border text-left transition-colors ${
              canAfford
                ? 'border-ces-gold/40 bg-ces-surface-raised/50 hover:bg-ces-surface-raised hover:border-ces-gold'
                : 'border-ces-border/30 bg-ces-surface/30 opacity-40 cursor-not-allowed'
            }`}
          >
            <div className="flex justify-between items-center">
              <span className={`text-xs font-semibold ${token.className}`}>{token.label}</span>
              <div className="text-right">
                <span className="text-ces-gold font-display font-semibold">{ep.price.amount}</span>
                <span className="text-ces-text-muted/50 text-[10px] ml-1.5">(bal: {balance.toString()})</span>
              </div>
            </div>
          </button>
        );
      })}
      <button onClick={() => onSelect({ status: 'cancelled' })} className="ces-btn-ghost w-full text-xs">
        Cancel
      </button>
    </div>
  );
}
