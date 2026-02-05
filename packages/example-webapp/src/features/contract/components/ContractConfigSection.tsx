import { Card, Message } from '../../../shared/ui';
import { CounterContractPanel } from './CounterContractPanel';
import { TokenMintContractPanel } from './TokenMintContractPanel';
import { useContractsConfig } from '../hooks/useContractsConfig';

interface ContractConfigSectionProps {
  networkId: string;
}

export function ContractConfigSection({ networkId }: ContractConfigSectionProps) {
  const result = useContractsConfig(networkId);

  if (result.status === 'loading') {
    return (
      <Card title="Contract Operations">
        <div className="p-4 text-gray-400">Loading contracts configuration...</div>
      </Card>
    );
  }

  if (result.status === 'error') {
    return (
      <Card title="Contract Operations">
        <Message variant="error">
          <strong>Error:</strong> {result.error}
        </Message>
      </Card>
    );
  }

  if (result.status === 'not-deployed') {
    return (
      <Card title="Contract Operations">
        <Message variant="warn" className="p-4">
          <p className="font-medium mb-2">Contracts not deployed for network &quot;{networkId}&quot;</p>
          <p className="text-sm text-amber-300">
            Run the following command in <code className="bg-black/30 px-1 rounded">contracts/</code> to deploy:
          </p>
          <pre className="mt-2 p-2 bg-black/30 rounded text-sm font-mono">npm run deploy-all {networkId}</pre>
        </Message>
      </Card>
    );
  }

  return (
    <Card title="Contract Operations">
      <Message variant="warn" className="mb-4">
        <strong>Note:</strong> These operations use the <strong>server&apos;s wallet</strong>, not your connected
        wallet. The server wallet is configured via environment variables.
      </Message>

      <div className="space-y-6">
        <TokenMintContractPanel networkId={networkId} config={result.config.tokenMint} />

        <div className="border-t border-dark-700" />

        <CounterContractPanel networkId={networkId} config={result.config.counter} />
      </div>
    </Card>
  );
}
