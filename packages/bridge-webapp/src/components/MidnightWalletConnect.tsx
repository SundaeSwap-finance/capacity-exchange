import { useCallback, useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import {
  requireBrowserEnv,
  createConnectedAPIFromMnemonic,
  LocalStorageStateStore,
} from '@capacity-exchange/midnight-core';
import type { WalletState } from '../hooks/useWallet';
import { connectMidnightWallet } from '../lib/midnight';
import { WalletConnect, type ConnectOption } from './WalletConnect';
import { MnemonicModal } from './MnemonicModal';

interface MidnightWalletConnectProps {
  wallet: WalletState<ConnectedAPI>;
  address?: string;
  balance?: string;
}

export function MidnightWalletConnect({ wallet, address, balance }: MidnightWalletConnectProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [viaMnemonic, setViaMnemonic] = useState(false);

  const handleConnectExtension = useCallback(() => {
    setViaMnemonic(false);
    wallet.connect(connectMidnightWallet);
  }, [wallet]);

  const handleOpenMnemonicModal = useCallback(() => {
    setModalOpen(true);
  }, []);

  const handleMnemonicSubmit = useCallback(
    (mnemonic: string) => {
      setModalOpen(false);
      setViaMnemonic(true);
      wallet.connect(async () => {
        return createConnectedAPIFromMnemonic(
          { mnemonic, networkId: requireBrowserEnv('VITE_NETWORK_ID') },
          new LocalStorageStateStore()
        );
      });
    },
    [wallet]
  );

  const handleModalClose = useCallback(() => {
    setModalOpen(false);
  }, []);

  const connectOptions: ConnectOption[] = [
    { label: 'Browser Extension', onSelect: handleConnectExtension },
    { label: 'Mnemonic Phrase', onSelect: handleOpenMnemonicModal },
  ];

  return (
    <>
      <WalletConnect
        label="Midnight"
        connectingLabel={viaMnemonic ? 'Syncing Midnight wallet…' : 'Connecting Midnight…'}
        wallet={wallet}
        connectOptions={connectOptions}
        address={address}
        balance={balance}
      />
      {modalOpen && <MnemonicModal onSubmit={handleMnemonicSubmit} onClose={handleModalClose} />}
    </>
  );
}
