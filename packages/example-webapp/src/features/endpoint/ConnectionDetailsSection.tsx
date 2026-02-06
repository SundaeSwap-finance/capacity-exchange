import type { EndpointConfig } from './types';
import { Card } from '../../shared/ui';
import { NetworkIdSelector } from './NetworkIdSelector';
import { EndpointsList } from './EndpointsList';

const DEFAULT_REFRESH_INTERVAL = 5000;

interface ConnectionDetailsSectionProps {
  endpoints: EndpointConfig[];
  networkId: string;
  onNetworkIdChange: (networkId: string) => void;
  refreshInterval?: number;
}

export function ConnectionDetailsSection({
  endpoints,
  networkId,
  onNetworkIdChange,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
}: ConnectionDetailsSectionProps) {
  return (
    <Card title="Connection Details">
      <NetworkIdSelector networkId={networkId} onChange={onNetworkIdChange} />
      <EndpointsList endpoints={endpoints} refreshInterval={refreshInterval} />
    </Card>
  );
}
