import { Button } from '../../shared/ui';
import { useContractContext } from '../contract/ContractContext';
import type { WalletCapabilities } from '../wallet/types';
import { useCESTransaction } from '../ces';
import { useCESReadiness } from './useCESReadiness';
import { useBrowserProviders } from './useBrowserProviders';
import { ReadinessMessages } from './ReadinessMessages';
import { CESTransactionFeedback } from './CESTransactionFeedback';
import type { ConnectedAPI } from '@midnight-ntwrk/dapp-connector-api';

interface SeedWalletConnection {
  type: 'seed';
  walletFacade: unknown;
  shieldedSecretKeys: {
    coinPublicKey: string;
    encryptionPublicKey: string;
  };
  dustSecretKey: unknown;
}

interface ExtensionWalletConnection {
  type: 'extension';
  connectedAPI: ConnectedAPI;
}

export type WalletConnection = SeedWalletConnection | ExtensionWalletConnection;

interface CounterIncrementInteractionProps {
  wallet: WalletCapabilities;
  walletConnection: WalletConnection;
}

export function CounterIncrementInteraction({ wallet, walletConnection }: CounterIncrementInteractionProps) {
  const contractContext = useContractContext();
  const contractAddress = contractContext.counterContract?.contractAddress ?? null;
  const tokenColor =
    contractContext.tokenMintContract?.derivedTokenColor || contractContext.tokenMintContract?.tokenColor || null;
  const cesReadiness = useCESReadiness(tokenColor);
  const { providers, walletInfo } = useBrowserProviders(wallet, walletConnection);
  const ces = useCESTransaction(providers, contractAddress);

  const hasTokenBalance =
    walletInfo.status === 'ready' && tokenColor !== null && (walletInfo.data.shieldedBalances[tokenColor] ?? 0n) > 0n;
  const cesReady = cesReadiness.status === 'ready' && cesReadiness.hasCurrency;
  const isProcessing = ces.status !== 'idle' && ces.status !== 'success' && ces.status !== 'error';
  const canIncrement = contractAddress !== null && providers !== null && cesReady && hasTokenBalance && !isProcessing;

  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-dark-200">Increment Counter</h4>

      <ReadinessMessages
        walletInfo={walletInfo}
        cesReadiness={cesReadiness}
        contractAddress={contractAddress}
        tokenColor={tokenColor}
        hasTokenBalance={hasTokenBalance}
        cesReady={cesReady}
      />

      <Button variant="blue" fullWidth onClick={ces.incrementCounter} disabled={!canIncrement || isProcessing}>
        {isProcessing ? 'Processing...' : 'Increment Counter (via CES)'}
      </Button>

      <CESTransactionFeedback ces={ces} />
    </div>
  );
}
