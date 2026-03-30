import { NarrativeCard } from '../components/NarrativeCard';
import { CounterCard } from '../components/CounterCard';
import { TokenBalanceCard } from '../components/TokenBalanceCard';
import type { WalletData } from '../features/wallet/types';
import type { UseSponsoredMintResult } from '../hooks/useSponsoredMint';
import type { UseCesTransactionResult } from '../features/ces/useCesTransaction';
import type { UseSponsoredTransactionResult } from '../features/ces/useSponsoredTransaction';
import type { OfferConfirmationResult } from '../features/ces/types';
import { useCountdown } from '../lib/hooks/useCountdown';
import { formatDust } from '../utils/format';
import type { NetworkConfig } from '../config';

interface PlaygroundStepProps {
  walletData: WalletData | null;
  sponsoredMint: UseSponsoredMintResult;
  cesTransaction: UseCesTransactionResult;
  sponsoredTransaction: UseSponsoredTransactionResult;
  tokenMintAddress: string | null;
  counterAddress: string | null;
  counterValue: string | null;
  config: NetworkConfig;
}

export function PlaygroundStep({
  walletData,
  sponsoredMint,
  cesTransaction,
  sponsoredTransaction,
  tokenMintAddress,
  counterAddress,
  counterValue,
  config,
}: PlaygroundStepProps) {
  const anyTransacting =
    sponsoredMint.status === 'building' || sponsoredMint.status === 'submitting' ||
    !['idle', 'success', 'error'].includes(cesTransaction.status) ||
    sponsoredTransaction.status === 'building' || sponsoredTransaction.status === 'submitting';

  return (
    <div className="space-y-4">
      <NarrativeCard heading="Playground">
        <p>
          You've seen both modes — <strong className="text-ces-accent">sponsored</strong> and{' '}
          <strong className="text-ces-gold">paid exchange</strong>. Now explore freely.
        </p>
      </NarrativeCard>

      <div className="grid grid-cols-2 gap-4">
        <CounterCard value={counterValue} freeze={anyTransacting} />
        <TokenBalanceCard
          balance={walletData ? Object.values(walletData.shieldedBalances).reduce((a, b) => a + b, 0n) : 0n}
          tokenLabel="Minted Token"
          freeze={anyTransacting}
        />
      </div>

      <div className="space-y-3">
        {/* Sponsored Mint */}
        <PlaygroundAction
          label="Mint 1,000 Tokens (Sponsored)"
          status={sponsoredMint.status}
          error={sponsoredMint.error}
          onAction={() => tokenMintAddress && sponsoredMint.mint(tokenMintAddress, 1000n)}
          onReset={sponsoredMint.reset}
          variant="accent"
        />

        {/* Sponsored Counter */}
        <PlaygroundAction
          label="Increment Counter (Sponsored)"
          status={sponsoredTransaction.status}
          error={sponsoredTransaction.error}
          onAction={sponsoredTransaction.incrementCounter}
          onReset={sponsoredTransaction.dismiss}
          variant="accent"
        />

        {/* CES Counter */}
        <CesPlaygroundAction cesTransaction={cesTransaction} />
      </div>
    </div>
  );
}

function PlaygroundAction({
  label,
  status,
  error,
  onAction,
  onReset,
  variant,
}: {
  label: string;
  status: string;
  error: string | null;
  onAction: () => void;
  onReset: () => void;
  variant: 'accent' | 'gold';
}) {
  const isActive = status !== 'idle' && status !== 'success' && status !== 'error';

  return (
    <div className="ces-card p-4">
      {status === 'idle' && (
        <button onClick={onAction} className={`${variant === 'accent' ? 'ces-btn-primary' : 'ces-btn-secondary'} w-full`}>
          {label}
        </button>
      )}

      {isActive && (
        <div className="flex items-center gap-3">
          <div className="ces-spinner-sm" />
          <span className="text-sm text-ces-text-muted">
            {status === 'building' ? 'Building proof...' : 'Submitting...'}
          </span>
        </div>
      )}

      {status === 'success' && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-ces-accent">Done!</span>
          <button onClick={onReset} className="ces-btn-ghost text-xs">
            Again
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-ces-danger">{error}</p>
          <button onClick={onReset} className="ces-btn-ghost text-xs">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

function CesPlaygroundAction({ cesTransaction }: { cesTransaction: UseCesTransactionResult }) {
  const { status, error, currencySelection, offerConfirmation, onCurrencySelected, onOfferConfirmed, incrementCounter, dismissOffer } =
    cesTransaction;

  const isActive = !['idle', 'success', 'error'].includes(status);

  return (
    <div className="ces-card p-4 space-y-3">
      {status === 'idle' && (
        <button onClick={incrementCounter} className="ces-btn-secondary w-full">
          Increment Counter (Pay with Tokens)
        </button>
      )}

      {isActive && (
        <>
          <div className="flex items-center gap-3">
            <div className="ces-spinner-sm" />
            <span className="text-sm text-ces-text-muted">
              {status === 'building'
                ? 'Building proof...'
                : status === 'selecting-currency'
                  ? 'Select currency...'
                  : status === 'fetching-offers'
                    ? 'Fetching offers...'
                    : status === 'confirming'
                      ? 'Confirm offer...'
                      : 'Submitting...'}
            </span>
          </div>

          {status === 'selecting-currency' && currencySelection && (
            <div className="space-y-2 pt-2 border-t border-ces-border">
              {currencySelection.prices.map((ep, i) => (
                <button
                  key={`${ep.price.currency}-${i}`}
                  onClick={() => onCurrencySelected({ status: 'selected', exchangePrice: ep })}
                  className="w-full p-2 rounded-lg border border-ces-border hover:bg-ces-surface-raised text-left transition-colors text-sm"
                >
                  <div className="flex justify-between">
                    <span className="text-ces-text-muted font-mono truncate max-w-[70%] text-xs">{ep.price.currency}</span>
                    <span className="text-ces-gold font-semibold">{ep.price.amount}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {status === 'confirming' && offerConfirmation && (
            <CompactOfferConfirmation offer={offerConfirmation.offer} specksRequired={offerConfirmation.specksRequired} onConfirm={onOfferConfirmed} />
          )}
        </>
      )}

      {status === 'success' && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-ces-accent">Counter incremented!</span>
          <button onClick={dismissOffer} className="ces-btn-ghost text-xs">
            Again
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="space-y-2">
          <p className="text-sm text-ces-danger">{error}</p>
          <button onClick={dismissOffer} className="ces-btn-ghost text-xs">
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

function CompactOfferConfirmation({
  offer,
  specksRequired,
  onConfirm,
}: {
  offer: { offerAmount: string; expiresAt: Date };
  specksRequired: bigint;
  onConfirm: (result: OfferConfirmationResult) => void;
}) {
  const { timeRemaining, isExpired } = useCountdown(offer.expiresAt);

  return (
    <div className="space-y-2 pt-2 border-t border-ces-border">
      <div className="flex justify-between text-xs">
        <span className="text-ces-text-muted">Pay {offer.offerAmount} for {formatDust(specksRequired)} DUST</span>
        <span className={isExpired ? 'text-ces-danger' : 'text-ces-text-muted'}>{timeRemaining}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onConfirm({ status: 'cancelled' })} className="ces-btn-ghost flex-1 text-xs py-1.5">
          Cancel
        </button>
        <button onClick={() => onConfirm({ status: 'confirmed' })} disabled={isExpired} className="ces-btn-primary flex-1 text-xs py-1.5">
          Confirm
        </button>
      </div>
    </div>
  );
}
