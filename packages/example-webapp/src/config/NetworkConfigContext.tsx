import React, { createContext, useContext } from 'react';
import type { NetworkConfig } from './networks';

const NetworkConfigContext = createContext<NetworkConfig | null>(null);

export function NetworkConfigProvider({ config, children }: { config: NetworkConfig; children: React.ReactNode }) {
  return <NetworkConfigContext.Provider value={config}>{children}</NetworkConfigContext.Provider>;
}

export function useNetworkConfig(): NetworkConfig {
  const config = useContext(NetworkConfigContext);
  if (!config) {
    throw new Error('useNetworkConfig must be used within a NetworkConfigProvider');
  }
  return config;
}
