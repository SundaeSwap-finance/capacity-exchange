import { useState, useEffect, useRef } from 'react';
import { NarrativeCard } from '../components/NarrativeCard';
import type { SeedWalletState } from '../features/wallet/seed/types';
import type { ExtensionWalletState } from '../features/wallet/extension/useExtensionWallet';
import type { WalletInfoState } from '../features/wallet/types';
import type { SubWalletProgress } from '../features/wallet/seed/walletService';
import type { StoredWallet } from '../hooks/useWalletStore';
import { useWalletStore } from '../hooks/useWalletStore';
import { UnpixelatedText } from '../shared/ui';

interface WalletStepProps {
  seedWallet: SeedWalletState;
  extensionWallet: ExtensionWalletState;
  walletInfoState: WalletInfoState;
  onConnected: () => void;
}

function progressPercent(p: SubWalletProgress): number {
  if (p.done) {return 100;}
  if (p.targetIndex === 0n) {return 0;}
  return Number((p.appliedIndex * 100n) / p.targetIndex);
}

function truncateSeed(hex: string): string {
  return `${hex.slice(0, 8)}...${hex.slice(-6)}`;
}

export function WalletStep({ seedWallet, extensionWallet, walletInfoState, onConnected }: WalletStepProps) {
  const { wallets, createWallet, removeWallet } = useWalletStore();
  const extensionAvailable = extensionWallet.status !== 'unavailable';
  const hasScheduledAdvanceRef = useRef(false);

  const isConnecting = seedWallet.status === 'connecting' || extensionWallet.status === 'connecting';
  const isConnected = seedWallet.status === 'connected' || extensionWallet.status === 'connected';
  const isSynced = walletInfoState.status === 'ready';
  const error = seedWallet.error || extensionWallet.error;

  const sp = seedWallet.syncProgress;

  // Auto-advance once wallet info is ready
  useEffect(() => {
    if (!isConnected || !isSynced) {
      hasScheduledAdvanceRef.current = false;
      return;
    }

    if (hasScheduledAdvanceRef.current) {
      return;
    }

    hasScheduledAdvanceRef.current = true;
    const timer = window.setTimeout(onConnected, 600);
    return () => window.clearTimeout(timer);
  }, [isConnected, isSynced, onConnected]);

  const handleGenerateAndConnect = () => {
    const wallet = createWallet();
    seedWallet.connect(wallet.seedHex);
  };

  const handleConnectSaved = (saved: StoredWallet) => {
    seedWallet.connect(saved.seedHex);
  };

  const handleConnectExtension = () => {
    extensionWallet.connect();
  };

  const showSpinner = isConnecting || (isConnected && !isSynced);

  return (
    <div className="ces-step-stack">
      <NarrativeCard heading="Welcome to Midnight">
        <p>
          On Midnight, users need a wallet and <strong className="text-ces-text">DUST</strong> to send transactions.
        </p>
        <p>
          This demo keeps that dependency visible on purpose so you can see what the <strong className="text-ces-text">Capacity Exchange</strong>{' '}
          is abstracting away for end users.
        </p>
        <p>
          First, connect a wallet or create one. Then we&apos;ll show both
          paths: app-sponsored onboarding and user-paid exchange.
        </p>
      </NarrativeCard>

      {isSynced ? (
        <div className="ces-card text-center py-8 ces-fade-in">
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
          <p className="text-ces-text font-display font-semibold">Wallet Ready</p>
          <button onClick={onConnected} className="ces-btn-primary mt-4">
            Continue
          </button>
        </div>
      ) : showSpinner ? (
        <div className="ces-card ces-section-stack py-5">
          <div className="text-center">
            <p className="text-ces-text font-display font-semibold">Syncing Midnight Wallet</p>
            <p className="mt-1 text-xs text-ces-text-muted">Loading balances, addresses, and DUST context for the demo.</p>
          </div>

          {sp ? (
            <div className="ces-section-stack px-2">
              <SyncBar label="Shielded" progress={sp.shielded} />
              <SyncBar label="Dust" progress={sp.dust} />
              <div className="grid grid-cols-[8rem,minmax(0,1fr)] items-center gap-x-4">
                <span className="text-xs text-ces-text-muted">Unshielded //</span>
                <span className={`text-xs ${sp.unshielded ? 'text-ces-accent' : 'text-ces-text-muted/50'}`}>
                  {sp.unshielded ? 'Done' : 'Waiting...'}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <div className="ces-spinner-sm" />
              <p className="text-sm text-ces-text-muted">Connecting...</p>
            </div>
          )}
        </div>
      ) : (
        <div className="ces-section-stack">
          {extensionAvailable && (
            <button onClick={handleConnectExtension} className="ces-btn-primary w-full py-4">
              Connect Lace
            </button>
          )}

          {/* Saved wallets */}
          {wallets.length > 0 && (
            <div className="ces-compact-stack">
              <p className="text-xs text-ces-text-muted uppercase tracking-wider font-medium px-1">Saved Wallets //</p>
              {wallets.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 p-3 border border-ces-border bg-ces-surface hover:bg-ces-surface-raised transition-colors"
                >
                  <button onClick={() => handleConnectSaved(w)} className="flex-1 text-left">
                    <span className="text-sm text-ces-text font-medium">{w.label}</span>
                    <span className="text-[10px] text-ces-text-muted/50 font-mono ml-2">{truncateSeed(w.seedHex)}</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeWallet(w.id);
                    }}
                    className="p-1.5 rounded hover:bg-ces-danger/10 text-ces-text-muted/40 hover:text-ces-danger transition-colors"
                    title="Delete wallet"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 12 10" fill="currentColor" aria-hidden="true">
                      <path d="M1 0h2v2H1V0Zm8 0h2v2H9V0ZM3 2h2v2H3V2Zm4 0h2v2H7V2ZM5 4h2v2H5V4ZM3 6h2v2H3V6Zm4 0h2v2H7V6ZM1 8h2v2H1V8Zm8 0h2v2H9V8Z" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleGenerateAndConnect}
            className={`${extensionAvailable || wallets.length > 0 ? 'ces-btn-secondary' : 'ces-btn-primary'} w-full py-4`}
          >
            <UnpixelatedText text="Create Wallet" />
          </button>

          {!extensionAvailable && wallets.length === 0 && (
            <p className="text-center text-ces-text-muted text-xs">
              No browser extension detected. We&apos;ll create a temporary
              wallet so the demo can still show how DUST handling works.
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg bg-ces-danger/10 border border-ces-danger/20 text-ces-danger text-sm">
          {error}
        </div>
      )}
    </div>
  );
}

function useEta(appliedIndex: bigint, targetIndex: bigint, done: boolean): string | null {
  const [startTime] = useState(() => Date.now());

  if (done || targetIndex === 0n || appliedIndex === 0n) {return null;}

  const elapsed = (Date.now() - startTime) / 1000;
  const pct = Number(appliedIndex) / Number(targetIndex);
  if (pct < 0.02) {return null;}
  const totalEstimate = elapsed / pct;
  const remaining = Math.max(0, Math.round(totalEstimate - elapsed));
  if (remaining < 2) {return '< 1s';}
  if (remaining < 60) {return `~${remaining}s`;}
  return `~${Math.ceil(remaining / 60)}m`;
}

function SyncBar({ label, progress }: { label: string; progress: SubWalletProgress }) {
  const pct = progressPercent(progress);
  const hasTarget = progress.targetIndex > 0n;
  const eta = useEta(progress.appliedIndex, progress.targetIndex, progress.done);

  return (
    <div>
      <div className="grid grid-cols-[8rem,minmax(0,28rem),2.5rem] items-center gap-x-4">
        <span className="text-xs text-ces-text-muted">{label} //</span>
        <div className="h-1.5 w-full rounded-full bg-ces-surface-raised overflow-hidden">
          <div
            className="h-full rounded-full bg-ces-accent transition-all duration-300 ease-out"
            style={{ width: `${progress.done ? 100 : Math.max(pct, hasTarget ? 1 : 0)}%` }}
          />
        </div>
        <span className="text-[10px] font-mono text-white text-right">
          {progress.done ? (
            <svg
              className="w-3.5 h-3.5 text-ces-accent inline"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : hasTarget ? (
            `${pct}%`
          ) : (
            '...'
          )}
        </span>
      </div>
      {eta && !progress.done && (
        <div className="mt-0.5 grid grid-cols-[8rem,minmax(0,28rem),2.5rem] gap-x-4">
          <span />
          <span className="text-[10px] text-white font-mono">{eta}</span>
          <span />
        </div>
      )}
    </div>
  );
}
