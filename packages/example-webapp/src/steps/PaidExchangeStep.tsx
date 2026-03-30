import { NarrativeCard } from '../components/NarrativeCard';
import { CounterCard } from '../components/CounterCard';
import { TokenBalanceCard } from '../components/TokenBalanceCard';
import { TransactionProgress } from '../components/TransactionProgress';
import { useCountdown } from '../lib/hooks/useCountdown';
import { formatDust } from '../utils/format';
import type { WalletData } from '../features/wallet/types';
import type { UseCesTransactionResult } from '../features/ces/useCesTransaction';
import type { ExchangePrice, CurrencySelectionResult, OfferConfirmationResult } from '../features/ces/types';
import type { Substep } from '../hooks/useTutorialState';

interface PaidExchangeStepProps {
  substep: Substep;
  walletData: WalletData | null;
  cesTransaction: UseCesTransactionResult;
  counterValue: string | null;
  onAdvance: () => void;
  onCesSuccess: () => void;
}

function getTokenBalance(walletData: WalletData | null): bigint {
  if (!walletData) return 0n;
  const balances = Object.values(walletData.shieldedBalances);
  return balances.length > 0 ? balances.reduce((a, b) => a + b, 0n) : 0n;
}

function InventoryStrip({ counterValue, walletData, freeze }: { counterValue: string | null; walletData: WalletData | null; freeze?: boolean }) {
  const tokenBalance = getTokenBalance(walletData);
  if (counterValue === null && tokenBalance === 0n) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <CounterCard value={counterValue} freeze={freeze} />
      <TokenBalanceCard balance={tokenBalance} tokenLabel="Minted Token" freeze={freeze} />
    </div>
  );
}

export function PaidExchangeStep({
  substep,
  walletData,
  cesTransaction,
  counterValue,
  onAdvance,
  onCesSuccess,
}: PaidExchangeStepProps) {
  if (substep === 'a') {
    return <PaidExchangeNarrative walletData={walletData} counterValue={counterValue} onContinue={onAdvance} />;
  }

  return <CesCounterAction cesTransaction={cesTransaction} walletData={walletData} counterValue={counterValue} onSuccess={onCesSuccess} />;
}

function PaidExchangeNarrative({ walletData, counterValue, onContinue }: { walletData: WalletData | null; counterValue: string | null; onContinue: () => void }) {
  return (
    <div className="space-y-4">
      <NarrativeCard heading="Pay for Your Own Transactions" variant="gold">
        <p>
          Sponsorship is great for onboarding, but what if the dApp doesn't want to cover your fees?
        </p>
        <p>
          The Capacity Exchange also lets you <strong className="text-ces-text">pay with any token it accepts</strong> —
          including the tokens you just minted.
        </p>
      </NarrativeCard>

      <InventoryStrip counterValue={counterValue} walletData={walletData} />

      <button onClick={onContinue} className="ces-btn-primary w-full">
        Let's try it
      </button>
    </div>
  );
}

function CesCounterAction({
  cesTransaction,
  walletData,
  counterValue,
  onSuccess,
}: {
  cesTransaction: UseCesTransactionResult;
  walletData: WalletData | null;
  counterValue: string | null;
  onSuccess: () => void;
}) {
  const { status, error, currencySelection, offerConfirmation, onCurrencySelected, onOfferConfirmed, incrementCounter, dismissOffer } =
    cesTransaction;

  const isTransacting = !['idle', 'success', 'error'].includes(status);

  const progressSteps = [
    {
      label: 'Building zero-knowledge proof...',
      status: (
        status === 'building'
          ? 'active'
          : ['selecting-currency', 'fetching-offers', 'confirming', 'submitting', 'success'].includes(status)
            ? 'done'
            : 'waiting'
      ) as 'active' | 'done' | 'waiting',
    },
    {
      label: 'Select payment currency',
      status: (
        status === 'selecting-currency'
          ? 'active'
          : ['fetching-offers', 'confirming', 'submitting', 'success'].includes(status)
            ? 'done'
            : 'waiting'
      ) as 'active' | 'done' | 'waiting',
    },
    {
      label: 'Fetch exchange offer',
      status: (
        status === 'fetching-offers'
          ? 'active'
          : ['confirming', 'submitting', 'success'].includes(status)
            ? 'done'
            : 'waiting'
      ) as 'active' | 'done' | 'waiting',
    },
    {
      label: 'Confirm & submit transaction',
      status: (
        status === 'confirming' || status === 'submitting'
          ? 'active'
          : status === 'success'
            ? 'done'
            : 'waiting'
      ) as 'active' | 'done' | 'waiting',
    },
  ];

  return (
    <div className="space-y-4">
      <NarrativeCard heading="Increment a Counter" variant="accent">
        <p>
          Let's interact with a smart contract — incrementing a counter.
          You'll pay for the transaction using the tokens you minted.
        </p>
      </NarrativeCard>

      <InventoryStrip counterValue={counterValue} walletData={walletData} freeze={isTransacting} />

      {status === 'idle' && (
        <button onClick={incrementCounter} className="ces-btn-primary w-full">
          Increment Counter (Pay with Tokens)
        </button>
      )}

      {status !== 'idle' && status !== 'success' && status !== 'error' && (
        <div className="ces-card space-y-4">
          <TransactionProgress steps={progressSteps} />

          {status === 'selecting-currency' && currencySelection && (
            <InlineCurrencySelection
              prices={currencySelection.prices}
              specksRequired={currencySelection.specksRequired}
              shieldedBalances={walletData?.shieldedBalances ?? {}}
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
            <p className="text-xs text-ces-text-muted">This can take 30–60 seconds...</p>
          )}
        </div>
      )}

      {status === 'success' && (
        <div className="ces-card text-center py-6">
          <div className="w-12 h-12 rounded-full bg-ces-accent/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-ces-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-ces-text font-display font-semibold text-lg">Counter Incremented!</p>
          <p className="text-ces-text-muted text-sm mt-1">
            You paid for a Midnight transaction <strong className="text-ces-gold">using your own tokens</strong>.
          </p>
          <button onClick={onSuccess} className="ces-btn-primary mt-6">
            Continue to Playground
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="ces-card space-y-3">
          <div className="p-3 rounded-lg bg-ces-danger/10 border border-ces-danger/20 text-ces-danger text-sm">{error}</div>
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
  onSelect,
}: {
  prices: ExchangePrice[];
  specksRequired: bigint;
  shieldedBalances: Record<string, bigint>;
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
    <div className="space-y-2 pt-2 border-t border-ces-border">
      <p className="text-sm text-ces-text-muted">
        This transaction needs <span className="text-ces-text font-mono">{formatDust(specksRequired)}</span> DUST
        (<span className="font-mono">{specksRequired.toString()}</span> specks).
        Pick a currency to pay with:
      </p>
      {sortedPrices.map((ep, i) => {
        const balance = shieldedBalances[ep.price.currency] ?? 0n;
        const cost = BigInt(ep.price.amount);
        const canAfford = balance >= cost;

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
              <span className="text-ces-text-muted text-xs font-mono truncate max-w-[60%]">{ep.price.currency}</span>
              <div className="text-right">
                <span className="text-ces-gold font-display font-semibold">{ep.price.amount}</span>
                <span className="text-ces-text-muted/50 text-[10px] ml-1.5">
                  (bal: {balance.toString()})
                </span>
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
    <div className="space-y-3 pt-2 border-t border-ces-border">
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-ces-text-muted">DUST required</span>
          <span className="text-ces-text font-mono">{formatDust(specksRequired)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-ces-text-muted">You pay</span>
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
          Confirm & Pay
        </button>
      </div>
    </div>
  );
}
