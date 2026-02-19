import { useState } from 'react';
import type { DetectedWallet } from '../lib/cip30';

interface WalletConnectProps {
  wallets: DetectedWallet[];
  connectedWallet: string | null;
  address: string | null;
  balanceAda: string | null;
  connecting: boolean;
  error: string | null;
  onOpen: () => void;
  onConnect: (walletName: string) => void;
  onDisconnect: () => void;
}

function truncateAddress(addr: string): string {
  if (addr.length <= 20) {
    return addr;
  }
  return `${addr.slice(0, 12)}...${addr.slice(-8)}`;
}

function WalletConnecting() {
  return (
    <div className="chip gap-2">
      <div className="spinner" />
      <span className="text-dark-400">Connecting...</span>
    </div>
  );
}

function WalletConnected({
  name,
  address,
  balanceAda,
  onDisconnect,
}: {
  name: string;
  address: string;
  balanceAda: string | null;
  onDisconnect: () => void;
}) {
  return (
    <div className="chip gap-3">
      <div>
        <span className="text-dark-200 font-medium capitalize">{name}</span>
        <span className="separator">|</span>
        <span className="text-muted-xs font-mono">{truncateAddress(address)}</span>
        {balanceAda && (
          <>
            <span className="separator">|</span>
            <span className="text-dark-200 text-xs font-medium">{Number(balanceAda).toFixed(2)} ₳</span>
          </>
        )}
      </div>
      <button onClick={onDisconnect} className="btn-sm">
        Disconnect
      </button>
    </div>
  );
}

function DropdownError({ message }: { message: string }) {
  return <p className="text-red-400 text-xs px-3 py-2 border-b border-dark-700">{message}</p>;
}

function DropdownEmpty() {
  return <p className="text-muted-xs px-3 py-3">No CIP-30 wallet detected. Install a Cardano wallet extension.</p>;
}

function DropdownWalletItem({ wallet, onSelect }: { wallet: DetectedWallet; onSelect: () => void }) {
  return (
    <button onClick={onSelect} className="dropdown-item">
      {wallet.icon && <img src={wallet.icon} alt={wallet.name} className="h-5 w-5" />}
      <span className="capitalize">{wallet.name}</span>
    </button>
  );
}

function WalletDropdown({
  wallets,
  error,
  onSelect,
}: {
  wallets: DetectedWallet[];
  error: string | null;
  onSelect: (name: string) => void;
}) {
  return (
    <div className="dropdown-menu">
      {error && <DropdownError message={error} />}
      {wallets.length === 0 ? (
        <DropdownEmpty />
      ) : (
        <div className="py-1">
          {wallets.map((wallet) => (
            <DropdownWalletItem key={wallet.name} wallet={wallet} onSelect={() => onSelect(wallet.name)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function WalletConnect({
  wallets,
  connectedWallet,
  address,
  balanceAda,
  connecting,
  error,
  onOpen,
  onConnect,
  onDisconnect,
}: WalletConnectProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (connecting) {
    return <WalletConnecting />;
  }

  if (connectedWallet && address) {
    return (
      <WalletConnected name={connectedWallet} address={address} balanceAda={balanceAda} onDisconnect={onDisconnect} />
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => {
          onOpen();
          setDropdownOpen(!dropdownOpen);
        }}
        className="btn"
      >
        Connect Wallet
      </button>

      {dropdownOpen && (
        <WalletDropdown
          wallets={wallets}
          error={error}
          onSelect={(name) => {
            setDropdownOpen(false);
            onConnect(name);
          }}
        />
      )}
    </div>
  );
}
