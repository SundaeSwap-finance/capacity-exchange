import { useEffect, useRef } from 'react';
import { NarrativeCard } from '../components/NarrativeCard';
import { CounterCard } from '../components/CounterCard';
import { RotatingStatusText } from '../components/RotatingStatusText';
import { TokenBalanceCard } from '../components/TokenBalanceCard';
import type { WalletData } from '../features/wallet/types';
import type { UseSponsoredMintResult } from '../hooks/useSponsoredMint';
import type { UseCesTransactionResult } from '../features/ces/useCesTransaction';
import type { UseSponsoredTransactionResult } from '../features/ces/useSponsoredTransaction';
import type { OfferConfirmationResult } from '../features/ces/types';
import { useCountdown } from '../lib/hooks/useCountdown';
import { formatDust } from '../utils/format';
import { resolveTokenLabel } from '../utils/tokenLabels';
import type { NetworkConfig } from '../config';

interface PlaygroundStepProps {
  walletData: WalletData | null;
  sponsoredMint: UseSponsoredMintResult;
  cesTransaction: UseCesTransactionResult;
  sponsoredTransaction: UseSponsoredTransactionResult;
  tokenMintAddress: string | null;
  mintedTokenColor: string;
  counterAddress: string | null;
  counterValue: string | null;
  config: NetworkConfig;
  allowMockMintWithoutContractAddress?: boolean;
}

const MOCK_TOKEN_MINT_ADDRESS = 'mock-token-mint-address';

export function PlaygroundStep({
  walletData,
  sponsoredMint,
  cesTransaction,
  sponsoredTransaction,
  tokenMintAddress,
  mintedTokenColor,
  counterAddress,
  counterValue,
  config,
  allowMockMintWithoutContractAddress = false,
}: PlaygroundStepProps) {
  const anyTransacting =
    sponsoredMint.status === 'building' ||
    sponsoredMint.status === 'submitting' ||
    !['idle', 'success', 'error'].includes(cesTransaction.status) ||
    sponsoredTransaction.status === 'building' ||
    sponsoredTransaction.status === 'submitting';

  // Freeze the displayed balance while any transaction is in flight so
  // the wallet SDK's optimistic deduction doesn't confuse the user.
  const frozenWalletDataRef = useRef<typeof walletData>(null);
  useEffect(() => {
    if (anyTransacting && !frozenWalletDataRef.current) {
      frozenWalletDataRef.current = walletData;
    } else if (!anyTransacting) {
      frozenWalletDataRef.current = null;
    }
  }, [anyTransacting, walletData]);
  const displayWalletData = frozenWalletDataRef.current ?? walletData;

  return (
    <div className="ces-step-stack">
      <NarrativeCard heading="Playground">
        <p>
          You&apos;ve seen both DUST-handling modes - <strong className="text-ces-accent">sponsored</strong> and{' '}
          <strong className="text-ces-gold">user-paid through exchange</strong>. Now explore both flows freely.
        </p>
        <p>
          This keeps the underlying Midnight and Cardano steps visible while still showing the cleaner product
          experience you want for end users.
        </p>
      </NarrativeCard>

      <div className="ces-inventory-grid">
        <CounterCard value={counterValue} freeze={anyTransacting} />
        <TokenBalanceCard
          balance={
            displayWalletData ? Object.values(displayWalletData.shieldedBalances).reduce((a, b) => a + b, 0n) : 0n
          }
          tokenLabel="Tutorial Tokens"
        />
      </div>

      <div className="ces-section-stack">
        {/* Sponsored Mint */}
        <PlaygroundAction
          label="Mint 1,000 Tokens (App Pays DUST)"
          status={sponsoredMint.status}
          error={sponsoredMint.error}
          onAction={() => {
            const resolvedTokenMintAddress =
              tokenMintAddress ?? (allowMockMintWithoutContractAddress ? MOCK_TOKEN_MINT_ADDRESS : null);
            if (!resolvedTokenMintAddress) return;
            sponsoredMint.mint(resolvedTokenMintAddress, 1000n);
          }}
          onReset={sponsoredMint.reset}
          variant="accent"
        />

        {/* CES Counter */}
        <CesPlaygroundAction
          cesTransaction={cesTransaction}
          shieldedBalances={displayWalletData?.shieldedBalances ?? {}}
          mintedTokenColor={mintedTokenColor}
        />
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

  // Auto-reset on success/error so the action is immediately available again
  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const t = setTimeout(onReset, status === 'success' ? 1500 : 3000);
      return () => clearTimeout(t);
    }
  }, [status, onReset]);

  return (
    <div className="ces-card p-4">
      {(status === 'idle' || status === 'success') && (
        <button
          onClick={onAction}
          disabled={status === 'success'}
          className={`${variant === 'accent' ? 'ces-btn-primary' : 'ces-btn-secondary'} w-full`}
        >
          {status === 'success' ? 'Done!' : label}
        </button>
      )}

      {isActive && (
        <div className="ces-compact-stack">
          <div className="flex items-center gap-3">
            <div className="ces-spinner-sm" />
            <span className="text-sm text-ces-text-muted">
              {status === 'building' ? 'Building proof...' : 'Submitting...'}
            </span>
          </div>
          <RotatingStatusText
            active
            messages={
              status === 'building'
                ? [
                    'Preparing the sponsored Midnight transaction.',
                    'Capacity Exchange will attach DUST sponsorship after the proof is ready.',
                    'This keeps onboarding simple for the end user while the demo exposes the hidden work.',
                  ]
                : [
                    'Submitting sponsored settlement through Cardano.',
                    'Waiting for confirmation before the Midnight state update lands.',
                    'The app is still covering DUST here, even though the user never sees that burden.',
                  ]
            }
          />
        </div>
      )}

      {status === 'error' && (
        <div className="ces-compact-stack">
          <p className="text-sm text-ces-danger">{error}</p>
        </div>
      )}
    </div>
  );
}

function CesPlaygroundAction({
  cesTransaction,
  shieldedBalances,
  mintedTokenColor,
}: {
  cesTransaction: UseCesTransactionResult;
  shieldedBalances: Record<string, bigint>;
  mintedTokenColor: string;
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

  const isActive = !['idle', 'success', 'error'].includes(status);

  useEffect(() => {
    if (status === 'success' || status === 'error') {
      const t = setTimeout(dismissOffer, status === 'success' ? 1500 : 3000);
      return () => clearTimeout(t);
    }
  }, [status, dismissOffer]);

  return (
    <div className="ces-card ces-section-stack p-4">
      {(status === 'idle' || status === 'success') && (
        <button onClick={incrementCounter} disabled={status === 'success'} className="ces-btn-secondary w-full">
          {status === 'success' ? 'Demo user registered!' : 'Register User (Pay with Tokens)'}
        </button>
      )}

      {isActive && (
        <>
          <div className="flex items-center gap-3">
            <div className="ces-spinner-sm" />
            <span className="text-sm text-ces-text-muted">
              {status === 'building'
                ? 'Building registration proof...'
                : status === 'selecting-currency'
                  ? 'Choose asset for DUST...'
                  : status === 'fetching-offers'
                    ? 'Fetching live quote...'
                    : status === 'confirming'
                      ? 'Confirm registration...'
                      : 'Submitting settlement...'}
            </span>
          </div>

          {status === 'building' && (
            <RotatingStatusText
              active
              messages={[
                'Preparing the private registration payload.',
                'Calculating the DUST requirement for this contract call.',
                'The selected asset will be exchanged so the user never has to hold DUST directly.',
              ]}
            />
          )}

          {status === 'fetching-offers' && (
            <RotatingStatusText
              active
              messages={[
                'Requesting a fresh quote from Capacity Exchange.',
                'Translating the DUST requirement into a user-facing asset price.',
                'This is the bridge between Midnight fees and a simpler app experience.',
              ]}
            />
          )}

          {status === 'submitting' && (
            <RotatingStatusText
              active
              messages={[
                'Submitting Cardano settlement now.',
                'Waiting for confirmation before the Midnight state update is finalized.',
                'The next demo registration number will appear when the flow completes.',
              ]}
            />
          )}

          {status === 'selecting-currency' && currencySelection && (
            <div className="ces-compact-stack border-t border-ces-border pt-2">
              {[...currencySelection.prices]
                .sort((a, b) => {
                  const balA = shieldedBalances[a.price.currency] ?? 0n;
                  const balB = shieldedBalances[b.price.currency] ?? 0n;
                  const canA = balA >= BigInt(a.price.amount);
                  const canB = balB >= BigInt(b.price.amount);
                  if (canA && !canB) return -1;
                  if (!canA && canB) return 1;
                  return 0;
                })
                .map((ep, i) => {
                  const balance = shieldedBalances[ep.price.currency] ?? 0n;
                  const canAfford = balance >= BigInt(ep.price.amount);
                  const token = resolveTokenLabel(ep.price.currency, mintedTokenColor);
                  return (
                    <button
                      key={`${ep.price.currency}-${i}`}
                      onClick={() => onCurrencySelected({ status: 'selected', exchangePrice: ep })}
                      disabled={!canAfford}
                      className={`w-full p-2 rounded-lg border text-left transition-colors text-sm ${canAfford ? 'border-ces-border hover:bg-ces-surface-raised' : 'border-ces-border/30 opacity-40 cursor-not-allowed'}`}
                    >
                      <div className="flex justify-between">
                        <span className={`text-xs font-semibold ${token.className}`}>{token.label}</span>
                        <span className="text-ces-gold font-semibold">{ep.price.amount}</span>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

          {status === 'confirming' && offerConfirmation && (
            <CompactOfferConfirmation
              offer={offerConfirmation.offer}
              specksRequired={offerConfirmation.specksRequired}
              onConfirm={onOfferConfirmed}
            />
          )}
        </>
      )}

      {status === 'error' && (
        <div className="ces-compact-stack">
          <p className="text-sm text-ces-danger">{error}</p>
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
    <div className="ces-compact-stack border-t border-ces-border pt-2">
      <div className="flex justify-between text-xs">
        <span className="text-ces-text-muted">
          Pay {offer.offerAmount} for {formatDust(specksRequired)} DUST
        </span>
        <span className={isExpired ? 'text-ces-danger' : 'text-ces-text-muted'}>{timeRemaining}</span>
      </div>
      <div className="flex gap-2">
        <button onClick={() => onConfirm({ status: 'cancelled' })} className="ces-btn-ghost flex-1 text-xs py-1.5">
          Cancel
        </button>
        <button
          onClick={() => onConfirm({ status: 'confirmed' })}
          disabled={isExpired}
          className="ces-btn-primary flex-1 text-xs py-1.5"
        >
          Confirm
        </button>
      </div>
    </div>
  );
}
