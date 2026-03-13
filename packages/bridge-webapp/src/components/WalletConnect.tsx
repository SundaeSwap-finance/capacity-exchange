// TODO: Move to shared frontend package (SUNDAE-2355)
import type { WalletState } from '../hooks/useWallet';
import { useAsyncDerived } from '../hooks/useAsyncDerived';
import { truncateAddress } from '../lib/format';
import { ConnectDropdown, type ConnectOption } from './ConnectDropdown';

export type { ConnectOption };

interface WalletConnectProps<T> {
  label: string;
  connectingLabel?: string;
  wallet: WalletState<T>;
  connectOptions: ConnectOption[];
  deriveAddress: (data: T) => Promise<string>;
  deriveBalance: (data: T) => Promise<string>;
}

export function WalletConnect<T>({
  label,
  connectingLabel,
  wallet,
  connectOptions,
  deriveAddress,
  deriveBalance,
}: WalletConnectProps<T>) {
  const address = useAsyncDerived(wallet.data, deriveAddress);
  const balance = useAsyncDerived(wallet.data, deriveBalance);

  if (wallet.status === 'connecting') {
    return (
      <div className="chip gap-2">
        <div className="spinner" />
        <span className="text-dark-400">{connectingLabel ?? `Connecting ${label}…`}</span>
      </div>
    );
  }

  if (wallet.status === 'connected' && wallet.data) {
    return (
      <div className="chip gap-3">
        <div>
          <span className="text-dark-200 font-medium">{label}</span>
          {address && (
            <>
              <span className="separator">|</span>
              <span className="text-muted-xs font-mono">{truncateAddress(address)}</span>
            </>
          )}
          {balance && (
            <>
              <span className="separator">|</span>
              <span className="text-dark-200 text-xs font-medium">{balance}</span>
            </>
          )}
        </div>
        <button onClick={wallet.disconnect} className="btn-sm">
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <ConnectDropdown label={label} error={wallet.status === 'error' ? wallet.error : null} options={connectOptions} />
  );
}
