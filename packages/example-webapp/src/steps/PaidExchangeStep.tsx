import { useEffect, useRef } from 'react';
import { NarrativeCard } from '../components/NarrativeCard';
import { RotatingStatusText } from '../components/RotatingStatusText';
import { CounterCard } from '../components/CounterCard';
import { TokenBalanceCard } from '../components/TokenBalanceCard';
import { TransactionProgress } from '../components/TransactionProgress';
import { useCountdown } from '../lib/hooks/useCountdown';
import { formatDust } from '../utils/format';
import type { WalletData } from '../features/wallet/types';
import type { UseCesTransactionResult } from '../features/ces/useCesTransaction';
import type { ExchangePrice, CurrencySelectionResult, OfferConfirmationResult } from '../features/ces/types';
import { resolveTokenLabel } from '../utils/tokenLabels';

interface PaidExchangeStepProps {
  walletData: WalletData | null;
  cesTransaction: UseCesTransactionResult;
  counterValue: string | null;
  mintedTokenColor: string | null;
  onCesSuccess: () => void;
}

function getTokenBalance(walletData: WalletData | null): bigint {
  if (!walletData) return 0n;
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
  if (counterValue === null && tokenBalance === 0n) return null;

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
}: PaidExchangeStepProps) {
  return (
    <CesCounterAction
      cesTransaction={cesTransaction}
      walletData={walletData}
      counterValue={counterValue}
      mintedTokenColor={mintedTokenColor}
      onSuccess={onCesSuccess}
    />
  );
}

function CesCounterAction({
  cesTransaction,
  walletData,
  counterValue,
  mintedTokenColor,
  onSuccess,
}: {
  cesTransaction: UseCesTransactionResult;
  walletData: WalletData | null;
  counterValue: string | null;
  mintedTokenColor: string | null;
  onSuccess: () => void;
}) {
  const {
    status,
    error,
    currencySelection,
    offerConfirmation,
    onCurrencySelected,
    onOfferConfirmed,
    incrementCounter,
    dismissOffer,
  } = cesTransaction;

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
        : ['selecting-currency', 'fetching-offers', 'confirming', 'submitting', 'success'].includes(status)
          ? 'done'
          : 'waiting') as 'active' | 'done' | 'waiting',
    },
    {
      label: 'Choose asset to satisfy DUST',
      status: (status === 'selecting-currency'
        ? 'active'
        : ['fetching-offers', 'confirming', 'submitting', 'success'].includes(status)
          ? 'done'
          : 'waiting') as 'active' | 'done' | 'waiting',
    },
    {
      label: 'Request live exchange quote',
      status: (status === 'fetching-offers'
        ? 'active'
        : ['confirming', 'submitting', 'success'].includes(status)
          ? 'done'
          : 'waiting') as 'active' | 'done' | 'waiting',
    },
    {
      label: 'Confirm & register user',
      status: (status === 'confirming' || status === 'submitting'
        ? 'active'
        : status === 'success'
          ? 'done'
          : 'waiting') as 'active' | 'done' | 'waiting',
    },
  ];

  return (
    <div className="ces-step-stack">
      <NarrativeCard heading="Register This User" variant="accent">
        <p>Popular dApps may not have enough DUST to cover every transaction.</p>
        <p>
          The Capacity Exchange also lets users pay themselves with{' '}
          <strong className="text-ces-text">any other asset</strong> accepted by the marketplace.
        </p>
        <p>
          Let's register that you graduated this tutorial, paying the transaction fees with the token you just minted.
        </p>
      </NarrativeCard>

      <InventoryStrip counterValue={counterValue} walletData={displayWalletData} freeze={isTransacting} />

      {status === 'idle' && (
        <button onClick={incrementCounter} className="ces-btn-primary w-full">
          Register Graduation (Pay with Tutorial Tokens)
        </button>
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

          {status === 'confirming' && offerConfirmation && (
            <InlineOfferConfirmation
              offer={offerConfirmation.offer}
              specksRequired={offerConfirmation.specksRequired}
              onConfirm={onOfferConfirmed}
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
                'When this completes, your graduation will be recorded!',
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
          <p className="mt-1 text-sm text-ces-text-muted">
            You've registered your graduation without ever requiring DUST.
          </p>
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
    const balA = shieldedBalances[a.price.currency] ?? 0n;
    const balB = shieldedBalances[b.price.currency] ?? 0n;
    const canAffordA = balA >= BigInt(a.price.amount);
    const canAffordB = balB >= BigInt(b.price.amount);
    if (canAffordA && !canAffordB) return -1;
    if (!canAffordA && canAffordB) return 1;
    return 0;
  });

  return (
    <div className="ces-compact-stack border-t border-ces-border pt-2">
      <p className="text-sm text-ces-text-muted">
        This transaction needs <span className="text-ces-text font-mono">{formatDust(specksRequired)}</span> DUST (
        <span className="font-mono">{specksRequired.toString()}</span> specks). Pick which accepted asset should cover
        it:
      </p>
      {sortedPrices.map((ep, i) => {
        const balance = shieldedBalances[ep.price.currency] ?? 0n;
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
                ? 'border-ces-border bg-ces-surface-raised/50 hover:bg-ces-surface-raised'
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

function InlineOfferConfirmation({
  offer,
  specksRequired,
  onConfirm,
}: {
  offer: { offerId: string; offerAmount: string; offerCurrency: string; expiresAt: Date };
  specksRequired: bigint;
  onConfirm: (result: OfferConfirmationResult) => void;
}) {
  const { timeRemaining, isExpired } = useCountdown(offer.expiresAt);

  return (
    <div className="ces-section-stack border-t border-ces-border pt-2">
      <div className="ces-compact-stack">
        <div className="flex justify-between text-sm">
          <span className="text-ces-text-muted">DUST required</span>
          <span className="text-ces-text font-mono">{formatDust(specksRequired)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ces-text-muted">User pays</span>
          <span className="text-ces-gold font-display font-semibold">{offer.offerAmount}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ces-text-muted">Expires in</span>
          <span className={isExpired ? 'text-ces-danger' : 'text-ces-text'}>{timeRemaining}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <button onClick={() => onConfirm({ status: 'back' })} className="ces-btn-ghost flex-1">
          Back
        </button>
        <button
          onClick={() => onConfirm({ status: 'confirmed' })}
          disabled={isExpired}
          className="ces-btn-primary flex-1"
        >
          Confirm & Register
        </button>
      </div>
    </div>
  );
}
