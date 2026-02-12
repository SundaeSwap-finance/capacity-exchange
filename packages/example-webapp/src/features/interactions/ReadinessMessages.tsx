import { LoadingSpinner, Message } from '../../shared/ui';
import type { WalletInfoState } from '../wallet/types';
import type { CESReadiness } from './useCESReadiness';

interface ReadinessMessagesProps {
  walletInfo: WalletInfoState;
  cesReadiness: CESReadiness;
  contractAddress: string | null;
  tokenColor: string | null;
  hasTokenBalance: boolean;
  cesReady: boolean;
}

export function ReadinessMessages({
  walletInfo,
  cesReadiness,
  contractAddress,
  tokenColor,
  hasTokenBalance,
  cesReady,
}: ReadinessMessagesProps) {
  return (
    <>
      {walletInfo.status === 'loading' && <LoadingSpinner message="Loading wallet info..." />}

      {walletInfo.status === 'error' && <Message variant="error">{walletInfo.error}</Message>}

      {!contractAddress && <Message variant="warn">Deploy a counter contract first.</Message>}

      {cesReadiness.status === 'loading' && <LoadingSpinner message="Checking Capacity Exchange Service..." />}

      {cesReadiness.status === 'offline' && (
        <Message variant="error">Capacity Exchange Service is offline: {cesReadiness.error}</Message>
      )}

      {cesReadiness.status === 'syncing' && (
        <Message variant="warn">Capacity Exchange Service is syncing. Please wait.</Message>
      )}

      {cesReadiness.status === 'ready' && !cesReadiness.hasCurrency && tokenColor && (
        <Message variant="warn">
          Token color not found in CES currencies. Add it to{' '}
          <code className="bg-black/30 px-1 rounded">price-formulas.json</code> and restart the CES.
          <br />
          Token color:{' '}
          <code
            className="bg-black/30 px-1 rounded cursor-pointer hover:bg-black/50 transition-colors break-all"
            title="Click to copy"
            onClick={() => navigator.clipboard.writeText(tokenColor)}
          >
            {tokenColor}
          </code>
        </Message>
      )}

      {walletInfo.status === 'ready' && !hasTokenBalance && cesReady && contractAddress && (
        <Message variant="warn">
          Your wallet has no tokens of this color. Mint and send tokens using Contract Operations.
        </Message>
      )}
    </>
  );
}
