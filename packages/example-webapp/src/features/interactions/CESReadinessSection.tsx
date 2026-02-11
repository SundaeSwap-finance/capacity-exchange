import { Card, Message } from '../../shared/ui';
import { useContractContext } from '../contract/ContractContext';
import type { WalletCapabilities } from '../wallet/types';
import type { WalletConnection } from '../wallet/types';
import { useBrowserProviders } from './useBrowserProviders';
import { useCESReadiness } from './useCESReadiness';
import { ReadinessMessages } from './ReadinessMessages';

interface CESReadinessSectionProps {
  wallet: WalletCapabilities;
  walletConnection: WalletConnection;
}

export function CESReadinessSection({ wallet, walletConnection }: CESReadinessSectionProps) {
  const contractContext = useContractContext();
  const contractAddress = contractContext.counterContract?.contractAddress ?? null;
  const tokenColor =
    contractContext.tokenMintContract?.derivedTokenColor || contractContext.tokenMintContract?.tokenColor || null;
  const cesReadiness = useCESReadiness(tokenColor);
  const { walletInfo } = useBrowserProviders(wallet, walletConnection);

  const hasTokenBalance =
    walletInfo.status === 'ready' && tokenColor !== null && (walletInfo.data.shieldedBalances[tokenColor] ?? 0n) > 0n;
  const cesReady = cesReadiness.status === 'ready' && cesReadiness.hasCurrency;

  return (
    <Card title="CES Readiness">
      <Message variant="info">
        Checking whether the Capacity Exchange Service is available for your deployed contracts.
      </Message>
      <div className="mt-3">
        <ReadinessMessages
          walletInfo={walletInfo}
          cesReadiness={cesReadiness}
          contractAddress={contractAddress}
          tokenColor={tokenColor}
          hasTokenBalance={hasTokenBalance}
          cesReady={cesReady}
        />
        {cesReady && contractAddress && hasTokenBalance && (
          <Message variant="success">CES is ready. Contract interactions will be available in a future update.</Message>
        )}
      </div>
    </Card>
  );
}
