import React from 'react';
import { useSubmit } from '../hooks/useSubmit';
import { useApiClient } from '../contexts/ApiContext';
import { ApiOffersPostOperationRequest, ApiOffersPost201Response } from '@capacity-exchange/client';

interface OffersRenderProps {
  submit: (args: ApiOffersPostOperationRequest) => Promise<ApiOffersPost201Response | undefined>;
  submitting: boolean;
  data: ApiOffersPost201Response | null;
  error: string | null;
}

interface OffersProps {
  children: (props: OffersRenderProps) => React.ReactNode;
}

const Offers: React.FC<OffersProps> = ({ children }) => {
  const api = useApiClient();
  const { submit, submitting, data, error } = useSubmit((args: ApiOffersPostOperationRequest) =>
    api.apiOffersPost(args)
  );

  return (
    <>
      {children({
        submit,
        submitting,
        data,
        error,
      })}
    </>
  );
};

export default Offers;
