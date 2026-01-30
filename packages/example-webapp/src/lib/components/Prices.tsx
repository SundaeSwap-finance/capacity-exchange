import React from 'react';
import { useApi } from '../hooks/useApi';
import { useApiClient } from '../contexts/ApiContext';
import { ApiPricesGet200Response } from '@capacity-exchange/client';

interface PricesRenderProps {
  error: string | null;
  prices: ApiPricesGet200Response | null;
}

interface PricesProps {
  children: (props: PricesRenderProps) => React.ReactNode;
  dust: string;
}

const Prices: React.FC<PricesProps> = ({ children, dust }) => {
  const api = useApiClient();
  const { data: prices, error } = useApi(() => api.apiPricesGet({ dust }), [dust], {
    pollInterval: 5000,
  });

  return (
    <>
      {children({
        error,
        prices,
      })}
    </>
  );
};

export default Prices;
