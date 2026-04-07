import React, { createContext, useContext, useMemo } from 'react';
import { DefaultApi, Configuration } from '@sundaeswap/capacity-exchange-client';
import type { NetworkConfig } from './networks';

interface NetworkConfigContextValue {
  config: NetworkConfig;
  // TODO: Make this a list
  cesClient: DefaultApi;
}

const NetworkConfigContext = createContext<NetworkConfigContextValue | null>(null);

export function NetworkConfigProvider({ config, children }: { config: NetworkConfig; children: React.ReactNode }) {
  const cesClient = useMemo(() => {
    const cesConfig = new Configuration({ basePath: config.capacityExchangeUrl });
    return new DefaultApi(cesConfig);
  }, [config.capacityExchangeUrl]);

  return (
    <NetworkConfigContext.Provider value={{ config, cesClient: cesClient }}>{children}</NetworkConfigContext.Provider>
  );
}

export function useNetworkConfig(): NetworkConfig {
  const ctx = useContext(NetworkConfigContext);
  if (!ctx) {
    throw new Error('useNetworkConfig must be used within a NetworkConfigProvider');
  }
  return ctx.config;
}

export function useCesClient(): DefaultApi {
  const ctx = useContext(NetworkConfigContext);
  if (!ctx) {
    throw new Error('useCesClient must be used within a NetworkConfigProvider');
  }
  return ctx.cesClient;
}
