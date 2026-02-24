import type { EndpointConfig } from './types';
import { Card } from '../../shared/ui';
import { EndpointsList } from './EndpointsList';

const DEFAULT_REFRESH_INTERVAL = 5000;

interface ConnectionDetailsSectionProps {
  endpoints: EndpointConfig[];
  refreshInterval?: number;
}

export function ConnectionDetailsSection({
  endpoints,
  refreshInterval = DEFAULT_REFRESH_INTERVAL,
}: ConnectionDetailsSectionProps) {
  return (
    <Card title="Connection Details">
      <EndpointsList endpoints={endpoints} refreshInterval={refreshInterval} />
    </Card>
  );
}
