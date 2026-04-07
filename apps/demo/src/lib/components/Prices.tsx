import React from 'react';
import { useApi } from '../hooks/useApi';
import { useCesClient } from '../../config';
import { ApiPricesGet200Response } from '@sundaeswap/capacity-exchange-client';

interface PricesRenderProps {
  error: string | null;
  prices: ApiPricesGet200Response | null;
}

interface PricesProps {
  children: (props: PricesRenderProps) => React.ReactNode;
  specks: string;
}

const Prices: React.FC<PricesProps> = ({ children, specks }) => {
  const api = useCesClient();
  const { data: prices, error } = useApi(() => api.apiPricesGet({ specks }), [specks], {
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
