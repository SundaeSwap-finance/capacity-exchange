import type { EndpointConfig } from '../features/endpoint/types';
import type { NetworkConfig } from './networks';

export type { EndpointConfig };

export function getEndpoints(config: NetworkConfig): EndpointConfig[] {
  return [
    { type: 'graphql', label: 'Indexer', url: config.indexerUrl },
    { type: 'rest', label: 'Proof Server', url: config.proofServerUrl, healthPath: '/health' },
    {
      type: 'rest',
      label: 'Capacity Exchange',
      url: config.capacityExchangeUrl,
      healthPath: '/health',
      readyPath: '/health/ready',
    },
  ];
}
