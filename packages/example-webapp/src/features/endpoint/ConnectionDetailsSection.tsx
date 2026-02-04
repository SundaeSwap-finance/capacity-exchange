import React from 'react';
import type { EndpointConfig } from './types';
import { Collapsible } from '../../shared/ui';
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
    <Collapsible title="Connection Details" defaultOpen>
      <div className="space-y-4">
        <NetworkIdSelector networkId={networkId} onChange={onNetworkIdChange} />
        <EndpointsList endpoints={endpoints} refreshInterval={refreshInterval} />
      </div>
    </Collapsible>
  );
}
