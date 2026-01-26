import React, { createContext, useContext, useMemo } from 'react';
import { DefaultApi, Configuration } from '@capacity-exchange/client';

interface ApiProviderProps {
  children: React.ReactNode;
  basePath: string;
}

const ApiContext = createContext<DefaultApi | null>(null);

export const ApiProvider: React.FC<ApiProviderProps> = ({ children, basePath }) => {
  const api = useMemo(() => {
    const config = new Configuration({ basePath });
    return new DefaultApi(config);
  }, [basePath]);

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
};

export const useApiClient = (): DefaultApi => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApiClient must be used within an ApiProvider');
  }
  return context;
};
