import { Card, Message } from '../../../shared/ui';

interface ContractConfigPlaceholderProps {
  status: 'loading' | 'error' | 'not-deployed';
  networkId: string;
  error?: string;
}

export function ContractConfigPlaceholder({ status, networkId, error }: ContractConfigPlaceholderProps) {
  return (
    <Card title="Contract Operations">
      {status === 'loading' && <div className="p-4 text-gray-400">Loading contracts configuration...</div>}

      {status === 'error' && (
        <Message variant="error">
          <strong>Error:</strong> {error}
        </Message>
      )}

      {status === 'not-deployed' && (
        <Message variant="warn" className="p-4">
          <p className="font-medium mb-2">Contracts not deployed for network &quot;{networkId}&quot;</p>
          <p className="text-sm text-amber-300">
            Run the following command in <code className="bg-black/30 px-1 rounded">contracts/</code> to deploy:
          </p>
          <pre className="mt-2 p-2 bg-black/30 rounded text-sm font-mono">npm run deploy-all {networkId}</pre>
        </Message>
      )}
    </Card>
  );
}
