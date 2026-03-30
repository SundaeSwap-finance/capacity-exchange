import { NarrativeCard } from '../components/NarrativeCard';
import { TokenBalanceCard } from '../components/TokenBalanceCard';
import { TransactionProgress } from '../components/TransactionProgress';
import type { WalletData } from '../features/wallet/types';
import type { UseSponsoredMintResult } from '../hooks/useSponsoredMint';
import type { Substep } from '../hooks/useTutorialState';

interface SponsoredStepProps {
  substep: Substep;
  walletData: WalletData | null;
  sponsoredMint: UseSponsoredMintResult;
  tokenMintAddress: string | null;
  mintedTokenColor: string | null;
  onAdvance: () => void;
  onMintSuccess: () => void;
}

function getTokenBalance(walletData: WalletData | null, tokenColor: string | null): bigint {
  if (!walletData || !tokenColor) return 0n;
  return walletData.shieldedBalances[tokenColor] ?? 0n;
}

export function SponsoredStep({
  substep,
  walletData,
  sponsoredMint,
  tokenMintAddress,
  mintedTokenColor,
  onAdvance,
  onMintSuccess,
}: SponsoredStepProps) {
  const tokenBalance = getTokenBalance(walletData, mintedTokenColor);
  const alreadyHasTokens = tokenBalance > 0n;

  if (substep === 'a') {
    return <EmptyDustNarrative alreadyHasTokens={alreadyHasTokens} onContinue={onAdvance} />;
  }

  return (
    <SponsoredMintAction
      sponsoredMint={sponsoredMint}
      tokenMintAddress={tokenMintAddress}
      alreadyHasTokens={alreadyHasTokens}
      tokenBalance={tokenBalance}
      onSuccess={onMintSuccess}
    />
  );
}

function EmptyDustNarrative({
  alreadyHasTokens,
  onContinue,
}: {
  alreadyHasTokens: boolean;
  onContinue: () => void;
}) {
  return (
    <div className="space-y-4">
      <NarrativeCard heading={alreadyHasTokens ? "Welcome back!" : "You don't have any DUST!"}>
        {alreadyHasTokens ? (
          <p>
            Looks like you already have tokens from a previous session.
            You can mint more using a <strong className="text-ces-text">sponsored transaction</strong>, or skip ahead.
          </p>
        ) : (
          <>
            <p>
              On Midnight, every transaction requires <strong className="text-ces-text">DUST</strong> to pay network fees.
              Without it, you can't do anything.
            </p>
            <p>
              But here's the thing — <strong className="text-ces-text">dApps can sponsor your transactions</strong>. They provide the
              DUST so you don't have to.
            </p>
          </>
        )}
      </NarrativeCard>

      <button onClick={onContinue} className="ces-btn-primary w-full">
        {alreadyHasTokens ? 'Show me how sponsorship works' : 'Show me how'}
      </button>

      {alreadyHasTokens && (
        <button onClick={() => { onContinue(); setTimeout(onContinue, 50); }} className="ces-btn-ghost w-full">
          Skip to paid exchange
        </button>
      )}
    </div>
  );
}

function SponsoredMintAction({
  sponsoredMint,
  tokenMintAddress,
  alreadyHasTokens,
  tokenBalance,
  onSuccess,
}: {
  sponsoredMint: UseSponsoredMintResult;
  tokenMintAddress: string | null;
  alreadyHasTokens: boolean;
  tokenBalance: bigint;
  onSuccess: () => void;
}) {
  const { status, error, mint, reset } = sponsoredMint;
  const canMint = !!tokenMintAddress && status === 'idle';
  const isTransacting = status === 'building' || status === 'submitting';

  const handleMint = () => {
    if (!tokenMintAddress) return;
    mint(tokenMintAddress, 1000n);
  };

  const progressSteps = [
    {
      label: 'Building zero-knowledge proof...',
      status: (status === 'building' ? 'active' : status === 'submitting' || status === 'success' ? 'done' : 'waiting') as
        | 'active'
        | 'done'
        | 'waiting',
    },
    {
      label: 'Sponsoring & submitting transaction...',
      status: (status === 'submitting' ? 'active' : status === 'success' ? 'done' : 'waiting') as
        | 'active'
        | 'done'
        | 'waiting',
    },
  ];

  return (
    <div className="space-y-4">
      <NarrativeCard heading="Sponsored Transaction" variant="accent">
        <p>
          {alreadyHasTokens
            ? 'You already have tokens, but let\'s mint more to show how sponsorship works. The CES server provides the DUST for free.'
            : <>Let's mint some tokens. The Capacity Exchange server will <strong className="text-ces-text">sponsor this transaction</strong> — providing the DUST for free.</>
          }
        </p>
        <p className="text-xs text-ces-text-muted/60">
          This is how dApps onboard new users without requiring them to acquire DUST first.
        </p>
      </NarrativeCard>

      <div className="flex justify-end">
        <TokenBalanceCard balance={tokenBalance} tokenLabel="Minted Token" freeze={isTransacting} />
      </div>

      {status === 'idle' && (
        <>
          <button onClick={handleMint} disabled={!canMint} className="ces-btn-primary w-full">
            Mint 1,000 Tokens (Sponsored)
          </button>
          {!tokenMintAddress && (
            <p className="text-xs text-ces-text-muted text-center">Loading contract config...</p>
          )}
          {alreadyHasTokens && (
            <button onClick={onSuccess} className="ces-btn-ghost w-full">
              Skip — I already have {tokenBalance.toString()} tokens
            </button>
          )}
        </>
      )}

      {(status === 'building' || status === 'submitting') && (
        <div className="ces-card">
          <TransactionProgress steps={progressSteps} />
          <p className="text-xs text-ces-text-muted mt-4">
            Building a zero-knowledge proof can take 30–60 seconds...
          </p>
        </div>
      )}

      {status === 'success' && (
        <div className="ces-card text-center py-6">
          <div className="w-12 h-12 rounded-full bg-ces-accent/20 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 text-ces-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-ces-text font-display font-semibold text-lg">Tokens Minted!</p>
          <p className="text-ces-text-muted text-sm mt-1">
            You just minted tokens <strong className="text-ces-accent">without any DUST</strong>. The dApp paid for you.
          </p>
          <button onClick={onSuccess} className="ces-btn-primary mt-6">
            Continue
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="ces-card space-y-3">
          <div className="p-3 rounded-lg bg-ces-danger/10 border border-ces-danger/20 text-ces-danger text-sm">{error}</div>
          <button onClick={reset} className="ces-btn-secondary w-full">
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
