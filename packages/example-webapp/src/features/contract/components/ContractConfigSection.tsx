import { Card, Message } from '../../../shared/ui';
import { CounterContractPanel } from './CounterContractPanel';
import { TokenMintContractPanel } from './TokenMintContractPanel';
import { useContractsConfig } from '../hooks/useContractsConfig';
import { useSyncContractContext } from './useSyncContractContext';
import { ContractConfigPlaceholder } from './ContractConfigPlaceholder';
import type { WalletCapabilities } from '../../wallet/types';
import type { ServerWallet } from '../../faucet';

interface ContractConfigSectionProps {
  networkId: string;
  wallet: WalletCapabilities | null;
  serverWallet: ServerWallet;
}

export function ContractConfigSection({ networkId, wallet, serverWallet }: ContractConfigSectionProps) {
  const result = useContractsConfig(networkId);
  const loadedConfig = result.status === 'loaded' ? result.config : null;
  useSyncContractContext(loadedConfig);

  if (result.status !== 'loaded') {
    return (
      <ContractConfigPlaceholder
        status={result.status}
        networkId={networkId}
        error={result.status === 'error' ? result.error : undefined}
      />
    );
  }

  return (
    <Card title="Contract Operations">
      <Message variant="info" className="mb-4">
        These operations use the <strong>server&apos;s wallet</strong>, not your connected wallet.
      </Message>
      {serverWallet.status === 'syncing' && (
        <Message variant="info" className="mb-4">
          Server wallet syncing...
        </Message>
      )}
      {serverWallet.status === 'error' && (
        <Message variant="error" className="mb-4">
          Server wallet error: {serverWallet.error}
        </Message>
      )}

      <div className="space-y-6">
        <TokenMintContractPanel config={result.config.tokenMint} wallet={wallet} serverWallet={serverWallet} />

        <div className="border-t border-dark-700" />

        <CounterContractPanel config={result.config.counter} />
      </div>
    </Card>
  );
}
