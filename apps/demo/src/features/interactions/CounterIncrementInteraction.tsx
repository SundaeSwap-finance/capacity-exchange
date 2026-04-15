import { Button, Card, Message } from '../../shared/ui';
import { useContractContext } from '../contract/ContractContext';
import type { WalletCapabilities, WalletConnection } from '../wallet/types';
import { useCesTransaction } from '../ces';
import { useSponsoredTransaction } from '../ces/useSponsoredTransaction';
import { useCesReadiness } from './useCesReadiness';
import { useWalletProviders } from './useWalletProviders';
import { ReadinessMessages } from './ReadinessMessages';
import { CesTransactionFeedback } from './CesTransactionFeedback';
import { SponsoredTransactionFeedback } from './SponsoredTransactionFeedback';

interface CounterIncrementInteractionProps {
  wallet: WalletCapabilities | null;
  walletConnection: WalletConnection | null;
}

export function CounterIncrementInteraction({ wallet, walletConnection }: CounterIncrementInteractionProps) {
  const contractContext = useContractContext();
  const contractAddress = contractContext.counterContract?.contractAddress ?? null;
  const tokenColor =
    contractContext.tokenMintContract?.derivedTokenColor || contractContext.tokenMintContract?.tokenColor || null;
  const cesReadiness = useCesReadiness(tokenColor);
  const { providers, walletInfo } = useWalletProviders(wallet, walletConnection);
  const ces = useCesTransaction(
    providers?.walletProvider ?? null,
    providers?.midnightProvider ?? null,
    providers?.balanceTransaction ?? null,
    contractAddress
  );
  const sponsored = useSponsoredTransaction(providers, contractAddress);

  const walletConnected = wallet !== null && walletConnection !== null;
  const hasTokenBalance =
    walletInfo.status === 'ready' && tokenColor !== null && (walletInfo.data.shieldedBalances[tokenColor] ?? 0n) > 0n;
  const cesReady = cesReadiness.status === 'ready' && cesReadiness.hasCurrency;
  const isCesProcessing = ces.status !== 'idle' && ces.status !== 'success' && ces.status !== 'error';
  const isSponsoredProcessing =
    sponsored.status !== 'idle' && sponsored.status !== 'success' && sponsored.status !== 'error';
  const isProcessing = isCesProcessing || isSponsoredProcessing;
  const baseReady = walletConnected && contractAddress !== null && providers !== null && cesReady && !isProcessing;
  const canCesIncrement = baseReady && hasTokenBalance;
  const canSponsoredIncrement = baseReady;

  return (
    <Card title="Contract Interactions">
      <Message variant="info">
        These operations use <strong>your connected wallet</strong> to interact with deployed contracts.
      </Message>
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-dark-200">Increment Counter</h4>

        <ReadinessMessages
          walletConnected={walletConnected}
          walletInfo={walletInfo}
          cesReadiness={cesReadiness}
          contractAddress={contractAddress}
          tokenColor={tokenColor}
          hasTokenBalance={hasTokenBalance}
        />

        <Button variant="blue" fullWidth onClick={ces.incrementCounter} disabled={!canCesIncrement || isProcessing}>
          {isCesProcessing ? 'Processing...' : 'Increment Counter (via CES)'}
        </Button>

        <CesTransactionFeedback ces={ces} />

        <Button
          variant="purple"
          fullWidth
          onClick={sponsored.incrementCounter}
          disabled={!canSponsoredIncrement || isProcessing}
        >
          {isSponsoredProcessing ? 'Processing...' : 'Increment Counter (Sponsored)'}
        </Button>

        <SponsoredTransactionFeedback sponsored={sponsored} />
      </div>
    </Card>
  );
}
