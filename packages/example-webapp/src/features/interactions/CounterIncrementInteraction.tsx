import { Button, Card, Message } from '../../shared/ui';
import { useContractContext } from '../contract/ContractContext';
import type { WalletCapabilities, WalletConnection } from '../wallet/types';
import { useCesTransaction } from '../ces';
import { useFundedTransaction } from '../ces/useFundedTransaction';
import { useCesReadiness } from './useCesReadiness';
import { useConnectedApiProviders } from './useConnectedApiProviders';
import { ReadinessMessages } from './ReadinessMessages';
import { CesTransactionFeedback } from './CesTransactionFeedback';
import { FundedTransactionFeedback } from './FundedTransactionFeedback';

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
  const { providers, walletInfo } = useConnectedApiProviders(wallet, walletConnection);
  const ces = useCesTransaction(providers, contractAddress);
  const funded = useFundedTransaction(providers, contractAddress);

  const walletConnected = wallet !== null && walletConnection !== null;
  const hasTokenBalance =
    walletInfo.status === 'ready' && tokenColor !== null && (walletInfo.data.shieldedBalances[tokenColor] ?? 0n) > 0n;
  const cesReady = cesReadiness.status === 'ready' && cesReadiness.hasCurrency;
  const isCesProcessing = ces.status !== 'idle' && ces.status !== 'success' && ces.status !== 'error';
  const isFundedProcessing = funded.status !== 'idle' && funded.status !== 'success' && funded.status !== 'error';
  const isProcessing = isCesProcessing || isFundedProcessing;
  const canIncrement =
    walletConnected && contractAddress !== null && providers !== null && cesReady && hasTokenBalance && !isProcessing;

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

        <Button variant="blue" fullWidth onClick={ces.incrementCounter} disabled={!canIncrement || isProcessing}>
          {isCesProcessing ? 'Processing...' : 'Increment Counter (via CES)'}
        </Button>

        <CesTransactionFeedback ces={ces} />

        <Button variant="purple" fullWidth onClick={funded.incrementCounter} disabled={!canIncrement || isProcessing}>
          {isFundedProcessing ? 'Processing...' : 'Increment Counter (Funded)'}
        </Button>

        <FundedTransactionFeedback funded={funded} />
      </div>
    </Card>
  );
}
