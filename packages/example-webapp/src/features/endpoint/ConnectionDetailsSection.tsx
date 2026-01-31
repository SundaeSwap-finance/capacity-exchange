import React from 'react';
import type { EndpointConfig } from './types';
import { Collapsible } from '../../shared/ui';
import { EndpointHealthRow } from './EndpointHealthRow';

interface ConnectionDetailsSectionProps {
  endpoints: EndpointConfig[];
}

export function ConnectionDetailsSection({ endpoints }: ConnectionDetailsSectionProps) {
  return (
    <Collapsible title="Connection Details" defaultOpen>
      <div className="space-y-3 text-sm">
        {endpoints.map((endpoint) => (
          <EndpointHealthRow
            key={endpoint.label}
            label={endpoint.label}
            url={endpoint.url}
            healthPath={endpoint.healthPath}
            readyPath={endpoint.readyPath}
            graphql={endpoint.graphql}
          />
        ))}
      </div>
    </Collapsible>
  );
}
