import {
  resolveEndpoints,
  toNetworkIdEnum,
  type NetworkEndpoints,
} from '@capacity-exchange/midnight-core';

export interface ResolvedNetwork {
  networkId: ReturnType<typeof toNetworkIdEnum>;
  endpoints: NetworkEndpoints;
}

/** Convert a network ID string to a resolved network with endpoints. */
export function resolveNetwork(networkIdStr: string, proofServerUrl?: string): ResolvedNetwork {
  const networkId = toNetworkIdEnum(networkIdStr);
  return {
    networkId,
    endpoints: resolveEndpoints(networkId, proofServerUrl),
  };
}
