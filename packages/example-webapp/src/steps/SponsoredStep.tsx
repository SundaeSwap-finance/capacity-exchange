import { useEffect, useRef, useState } from 'react';
import { NarrativeCard } from '../components/NarrativeCard';
import { RotatingStatusText } from '../components/RotatingStatusText';
import { TokenBalanceCard } from '../components/TokenBalanceCard';
import { TransactionProgress } from '../components/TransactionProgress';
import type { WalletData } from '../features/wallet/types';
import type { UseSponsoredMintResult } from '../hooks/useSponsoredMint';

interface SponsoredStepProps {
  walletData: WalletData | null;
  sponsoredMint: UseSponsoredMintResult;
  tokenMintAddress: string | null;
  mintedTokenColor: string | null;
  allowMockMintWithoutContractAddress?: boolean;
  autoAdvanceOnSuccess?: boolean;
  successAutoAdvanceDelayMs?: number;
  onMintSuccess: () => void;
  hasGraduated?: boolean;
  onSkipToPlayground?: () => void;
}

const MOCK_TOKEN_MINT_ADDRESS = 'mock-token-mint-address';

function getTokenBalance(walletData: WalletData | null, tokenColor: string | null): bigint {
  if (!walletData) {
    return 0n;
  }

  if (tokenColor && tokenColor in walletData.shieldedBalances) {
    return walletData.shieldedBalances[tokenColor] ?? 0n;
  }

  const balances = Object.values(walletData.shieldedBalances);
  return balances.length > 0 ? balances.reduce((sum, value) => sum + value, 0n) : 0n;
}

export function SponsoredStep({
  walletData,
  sponsoredMint,
  tokenMintAddress,
  mintedTokenColor,
  allowMockMintWithoutContractAddress = false,
  autoAdvanceOnSuccess = true,
  successAutoAdvanceDelayMs = 900,
  onMintSuccess,
  hasGraduated = false,
  onSkipToPlayground,
}: SponsoredStepProps) {
  const tokenBalance = getTokenBalance(walletData, mintedTokenColor);
  const alreadyHasTokens = tokenBalance > 0n;

  return (
    <SponsoredMintAction
      sponsoredMint={sponsoredMint}
      tokenMintAddress={tokenMintAddress}
      alreadyHasTokens={alreadyHasTokens}
      tokenBalance={tokenBalance}
      allowMockMintWithoutContractAddress={allowMockMintWithoutContractAddress}
      autoAdvanceOnSuccess={autoAdvanceOnSuccess}
      successAutoAdvanceDelayMs={successAutoAdvanceDelayMs}
      onSuccess={onMintSuccess}
      hasGraduated={hasGraduated}
      onSkipToPlayground={onSkipToPlayground}
    />
  );
}

function SponsoredMintAction({
  sponsoredMint,
  tokenMintAddress,
  alreadyHasTokens,
  tokenBalance,
  allowMockMintWithoutContractAddress,
  autoAdvanceOnSuccess,
  successAutoAdvanceDelayMs,
  onSuccess,
  hasGraduated,
  onSkipToPlayground,
}: {
  sponsoredMint: UseSponsoredMintResult;
  tokenMintAddress: string | null;
  alreadyHasTokens: boolean;
  tokenBalance: bigint;
  allowMockMintWithoutContractAddress: boolean;
  autoAdvanceOnSuccess: boolean;
  successAutoAdvanceDelayMs: number;
  onSuccess: () => void;
  hasGraduated: boolean;
  onSkipToPlayground?: () => void;
}) {
  type LocalMintUiPhase = 'idle' | 'building' | 'submitting' | 'success' | 'error';

  const { status, error, mint, reset } = sponsoredMint;
  const resolvedTokenMintAddress =
    tokenMintAddress ?? (allowMockMintWithoutContractAddress ? MOCK_TOKEN_MINT_ADDRESS : null);
  const [uiPhase, setUiPhase] = useState<LocalMintUiPhase>('idle');
  const successHandledRef = useRef(false);
  const progressCardRef = useRef<HTMLDivElement | null>(null);
  const mintStartBalanceRef = useRef<bigint | null>(null);
  const mintClickLockRef = useRef(false);
  const balanceConfirmed = mintStartBalanceRef.current !== null && tokenBalance > mintStartBalanceRef.current;
  // If the wallet balance has advanced, prefer the observed result over a stale async status.
  const syncedStatus = balanceConfirmed && status !== 'error' ? 'success' : status;
  const effectiveStatus =
    uiPhase === 'error'
      ? 'error'
      : uiPhase === 'success' || syncedStatus === 'success'
        ? 'success'
        : uiPhase === 'submitting' || syncedStatus === 'submitting'
          ? 'submitting'
          : uiPhase === 'building' || syncedStatus === 'building'
            ? 'building'
            : 'idle';
  const canMint = !!resolvedTokenMintAddress && effectiveStatus === 'idle';
  const isTransacting = effectiveStatus === 'building' || effectiveStatus === 'submitting';
  const showProgress = effectiveStatus === 'building' || effectiveStatus === 'submitting';

  const handleMint = () => {
    if (!resolvedTokenMintAddress || mintClickLockRef.current || effectiveStatus !== 'idle') {
      return;
    }
    mintClickLockRef.current = true;
    mintStartBalanceRef.current = tokenBalance;
    setUiPhase('building');
    mint(resolvedTokenMintAddress, 1000n);
  };

  useEffect(() => {
    if (status === 'building' || status === 'submitting' || status === 'success' || status === 'error') {
      setUiPhase(status);
      return;
    }

    if (status === 'idle' && mintStartBalanceRef.current === null) {
      setUiPhase('idle');
    }
  }, [status]);

  useEffect(() => {
    if (balanceConfirmed) {
      setUiPhase('success');
    }
  }, [balanceConfirmed]);

  useEffect(() => {
    if (effectiveStatus !== 'success') {
      successHandledRef.current = false;
      return;
    }

    if (!autoAdvanceOnSuccess) {
      return;
    }

    const timer = window.setTimeout(() => {
      if (successHandledRef.current) {
        return;
      }

      successHandledRef.current = true;
      onSuccess();
    }, successAutoAdvanceDelayMs);

    return () => window.clearTimeout(timer);
  }, [autoAdvanceOnSuccess, effectiveStatus, onSuccess, successAutoAdvanceDelayMs]);

  useEffect(() => {
    if (effectiveStatus === 'idle' || effectiveStatus === 'success' || effectiveStatus === 'error') {
      mintClickLockRef.current = false;
    }
  }, [effectiveStatus]);

  useEffect(() => {
    if (!isTransacting || !progressCardRef.current) {
      return;
    }

    progressCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [isTransacting]);

  const handleSuccessContinue = () => {
    if (successHandledRef.current) {
      return;
    }

    mintStartBalanceRef.current = null;
    successHandledRef.current = true;
    onSuccess();
  };

  const buildingLabel = (
    <RotatingStatusText
      as="span"
      active={effectiveStatus === 'building'}
      intervalMs={1800}
      className="text-sm py-1 text-ces-text"
      messages={['Building proof...', 'Preparing proof...', 'Mint proof in progress...']}
    />
  );

  const submittingLabel = (
    <RotatingStatusText
      as="span"
      active={effectiveStatus === 'submitting'}
      intervalMs={1800}
      className="text-sm py-1 text-ces-text"
      messages={['Sponsoring DUST...', 'Submitting mint...', 'Finalizing mint...']}
    />
  );

  const progressSteps = [
    {
      label: effectiveStatus === 'building' ? buildingLabel : 'Build private onboarding proof',
      status: (effectiveStatus === 'building'
        ? 'active'
        : effectiveStatus === 'submitting' || effectiveStatus === 'success'
          ? 'done'
          : 'waiting') as 'active' | 'done' | 'waiting',
    },
    {
      label: effectiveStatus === 'submitting' ? submittingLabel : 'Sponsor DUST and submit',
      status: (effectiveStatus === 'submitting' ? 'active' : effectiveStatus === 'success' ? 'done' : 'waiting') as
        | 'active'
        | 'done'
        | 'waiting',
    },
  ];

  return (
    <div className="ces-step-stack">
      <NarrativeCard heading="Sponsored Transaction" variant="accent">
        {alreadyHasTokens ? (
          <p>
            You already have tokens from a previous session, but this flow still shows how the app can sponsor the DUST
            requirement for a new user.
          </p>
        ) : (
          <>
            <p>Let's onboard you to a simple application we've built to show off the capacity exchange.</p>
            <p>We'll do this in two steps to show you the two ways this is supported.</p>
          </>
        )}
        <p>
          Whether it's a game, a real world service, or something else, the value comes from acquiring the user. The
          dApp is more than happy to cover the DUST transaction fees for you.
        </p>
      </NarrativeCard>

      <div className="w-full">
        <TokenBalanceCard balance={tokenBalance} tokenLabel="Tutorial Tokens" centered />
      </div>

      {effectiveStatus === 'idle' && !showProgress && (
        <>
          <div className="text-center">
            <button onClick={handleMint} disabled={!canMint} className="ces-btn-primary-mono w-full">
              Mint 1,000 Tutorial Tokens
            </button>
            <p className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.24em] text-ces-text">
              (app pays for DUST)
            </p>
          </div>
          {!resolvedTokenMintAddress && (
            <p className="text-xs text-ces-text-muted text-center">Loading contract config...</p>
          )}
          {alreadyHasTokens && (
            <button onClick={onSuccess} className="ces-btn-ghost w-full">
              Skip to paid exchange
            </button>
          )}
          {hasGraduated && onSkipToPlayground && (
            <button onClick={onSkipToPlayground} className="ces-btn-ghost w-full">
              Skip to playground
            </button>
          )}
        </>
      )}

      {showProgress && (
        <div ref={progressCardRef} className="ces-card">
          <TransactionProgress steps={progressSteps} />
        </div>
      )}

      {effectiveStatus === 'success' && (
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
          <p className="text-ces-text font-display font-semibold text-lg">Tutorial Tokens Minted</p>
          <p className="mt-1 text-sm text-ces-text-muted">
            You minted them yourself, <strong className="text-ces-accent">without needing DUST</strong>.
          </p>
          <button onClick={handleSuccessContinue} className="ces-btn-primary mt-4">
            Continue
          </button>
        </div>
      )}

      {effectiveStatus === 'error' && (
        <div className="ces-card ces-section-stack">
          <div className="p-3 rounded-lg bg-ces-danger/10 border border-ces-danger/20 text-ces-danger text-sm">
            {error}
          </div>
          <button
            onClick={() => {
              mintStartBalanceRef.current = null;
              mintClickLockRef.current = false;
              setUiPhase('idle');
              reset();
            }}
            className="ces-btn-secondary w-full"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
