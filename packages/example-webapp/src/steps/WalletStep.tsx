import { useState, useEffect } from 'react';
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
  // Extension wallet support disabled until wallets are more stable
  // const extensionAvailable = extensionWallet.status !== 'unavailable';
  const [showConnect, setShowConnect] = useState(false);
  const [activeMnemonic, setActiveMnemonic] = useState<string | null>(null);
  const [showExportSeed, setShowExportSeed] = useState(false);

  const isConnecting = seedWallet.status === 'connecting' || extensionWallet.status === 'connecting';
  const isConnected = seedWallet.status === 'connected' || extensionWallet.status === 'connected';
  const isSynced = walletInfoState.status === 'ready';
  const error = seedWallet.error || extensionWallet.error;

  const sp = seedWallet.syncProgress;
  const isSeedWalletSyncing = (isConnecting || isConnected) && !isSynced && extensionWallet.status === 'disconnected';

  // (User clicks Continue on the "Wallet Ready" screen to advance)

  // Skip intro if already connecting/connected
  useEffect(() => {
    if (isConnecting || isConnected) {
      setShowConnect(true);
    }
  }, [isConnecting, isConnected]);

  const handleGenerateAndConnect = () => {
    const wallet = createWallet();
    setActiveMnemonic(wallet.mnemonic);
    seedWallet.connect(wallet.seedHex);
  };

  const handleConnectSaved = (saved: StoredWallet) => {
    setActiveMnemonic(saved.mnemonic);
    seedWallet.connect(saved.seedHex);
  };

  const showSpinner = isConnecting || (isConnected && !isSynced);

  if (!showConnect) {
    return (
      <div className="ces-step-stack">
        <NarrativeCard heading="Welcome to Midnight">
          <p>
            On most blockchains, users need a token to pay network fees.
            This makes it very difficult to onboard new users.
          </p>
          <p>
            The <strong className="text-ces-text">Capacity Exchange</strong> solves this.
          </p>
        </NarrativeCard>

        <button onClick={() => setShowConnect(true)} className="ces-btn-primary w-full">
          Next
        </button>
      </div>
    );
  }

  if (isSynced) {
    return (
      <div className="ces-step-stack">
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
      </div>
    );
  }

  if (showSpinner) {
    return (
      <div className="ces-step-stack">
        <NarrativeCard heading="Syncing Wallet">
          {isSeedWalletSyncing ? (
            <>
              <p>
                You&apos;ve generated a new wallet in your browser for this test, and are now
                loading relevant data directly from the Midnight Blockchain.
              </p>
              <p>
                This might take a while, and will get faster with future updates.
              </p>
              {activeMnemonic && (
                <p>
                  There should be no need to keep this wallet, but if you&apos;d like to,
                  you can export the seed phrase{' '}
                  <button
                    onClick={() => setShowExportSeed(true)}
                    className="text-ces-accent underline underline-offset-2 hover:text-ces-text transition-colors"
                  >
                    here
                  </button>.
                </p>
              )}
            </>
          ) : (
            <p>Loading balances, addresses, and DUST context.</p>
          )}
        </NarrativeCard>

        <div className="ces-card ces-section-stack py-5">
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

        {showExportSeed && activeMnemonic && (
          <SeedExportModal mnemonic={activeMnemonic} onClose={() => setShowExportSeed(false)} />
        )}
      </div>
    );
  }

  return (
    <div className="ces-step-stack">
      <NarrativeCard heading="Connect a Wallet">
        <p>
          Transaction fees on Midnight are paid in <strong className="text-ces-text">DUST</strong>.
          DUST is generated by NIGHT.
          Through the Capacity Exchange, dApps can use their own DUST to pay for
          users&apos; transactions, removing onboarding friction.
        </p>
        <p>
          New users don&apos;t even need a new wallet, as we can generate one
          securely right in the browser.
        </p>
        <p>
          If you have a Midnight wallet, feel free to connect it, or generate a new one!
        </p>
      </NarrativeCard>

      <div className="ces-section-stack">
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
            className={`${wallets.length > 0 ? 'ces-btn-secondary' : 'ces-btn-primary'} w-full py-4`}
          >
            <UnpixelatedText text="Create Wallet" />
          </button>

          {wallets.length === 0 && (
            <p className="text-center text-ces-text-muted text-xs">
              We&apos;ll generate a temporary wallet so the demo can
              show how DUST handling works.
            </p>
          )}
      </div>

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

function SeedExportModal({ mnemonic, onClose }: { mnemonic: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const words = mnemonic.split(' ');

  const handleCopy = async () => {
    await navigator.clipboard.writeText(mnemonic);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="ces-card ces-section-stack p-4">
      <div className="flex items-center justify-between">
        <p className="text-ces-text font-display font-semibold text-sm">Seed Phrase</p>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-ces-surface-raised text-ces-text-muted hover:text-ces-text transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-3 rounded-lg bg-ces-surface-raised border border-ces-border grid grid-cols-3 gap-x-4 gap-y-1.5">
        {words.map((word, i) => (
          <div key={i} className="flex items-baseline gap-1.5">
            <span className="text-[10px] text-ces-text-muted/50 font-mono w-4 text-right">{i + 1}</span>
            <span className="text-xs font-mono text-ces-text select-all">{word}</span>
          </div>
        ))}
      </div>

      <div className="ces-compact-stack">
        <button onClick={handleCopy} className="ces-btn-secondary w-full text-sm">
          {copied ? 'Copied!' : 'Copy to Clipboard'}
        </button>
        <p className="text-[10px] text-ces-text-muted text-center">
          Store this phrase securely. Anyone with access to it can control this wallet.
        </p>
      </div>
    </div>
  );
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
