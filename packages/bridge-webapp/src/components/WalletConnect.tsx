// TODO: Move to shared frontend package (SUNDAE-2355)
import type { ReactNode } from 'react';
import type { WalletState } from '../hooks/useWallet';

interface WalletConnectProps<T> {
  label: string;
  wallet: WalletState<T>;
  renderConnected: (data: T) => ReactNode;
}

export function WalletConnect<T>({ label, wallet, renderConnected }: WalletConnectProps<T>) {
  if (wallet.status === 'connecting') {
    return (
      <div className="chip gap-2">
        <div className="spinner" />
        <span className="text-dark-400">Connecting {label}…</span>
      </div>
    );
  }

  if (wallet.status === 'connected' && wallet.data) {
    return (
      <div className="chip gap-3">
        <div>
          <span className="text-dark-200 font-medium">{label}</span>
          <span className="separator">|</span>
          {renderConnected(wallet.data)}
        </div>
        <button onClick={wallet.disconnect} className="btn-sm">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button onClick={wallet.connect} className="btn">
        Connect {label} Wallet
      </button>
      {wallet.status === 'error' && wallet.error && <p className="text-red-400 text-xs max-w-xs">{wallet.error}</p>}
    </div>
  );
}
