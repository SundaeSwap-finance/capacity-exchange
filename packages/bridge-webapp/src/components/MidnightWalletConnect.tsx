import { useCallback, useState } from 'react';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';
import {
  requireBrowserEnv,
  createConnectedAPIFromMnemonic,
  encodeShieldedAddress,
  LocalStorageStateStore,
} from '@capacity-exchange/midnight-core';
import type { WalletState } from '../hooks/useWallet';
import { connectMidnightWallet } from '../lib/midnight';
import { WalletConnect, type ConnectOption } from './WalletConnect';
import { MnemonicModal } from './MnemonicModal';

interface MidnightWalletConnectProps {
  wallet: WalletState<ConnectedAPI>;
}

const deriveAddress = async (connectedApi: ConnectedAPI) => {
  const networkId = requireBrowserEnv('VITE_NETWORK_ID');
  const raw = await connectedApi.getShieldedAddresses();
  const encoded = encodeShieldedAddress(networkId, raw.shieldedCoinPublicKey, raw.shieldedEncryptionPublicKey);
  if (!encoded.ok) {
    throw new Error(encoded.error);
  }
  return encoded.address;
};

const deriveBalance = async (connectedApi: ConnectedAPI) => {
  const unshielded = await connectedApi.getUnshieldedBalances();
  const night = Object.values(unshielded).reduce((sum, v) => sum + v, 0n);
  return `${(night / 1_000_000n).toLocaleString()} NIGHT`;
};

export function MidnightWalletConnect({ wallet }: MidnightWalletConnectProps) {
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
          {
            mnemonic,
            networkId: requireBrowserEnv('VITE_NETWORK_ID'),
            proofServerUrl: import.meta.env.VITE_PROOF_SERVER_URL,
          },
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
        deriveAddress={deriveAddress}
        deriveBalance={deriveBalance}
      />
      {modalOpen && <MnemonicModal onSubmit={handleMnemonicSubmit} onClose={handleModalClose} />}
    </>
  );
}
