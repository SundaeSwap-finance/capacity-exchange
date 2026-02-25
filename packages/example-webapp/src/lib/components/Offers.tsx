import React, { useState } from 'react';
import { useSubmit } from '../hooks/useSubmit';
import { useCesClient } from '../../config';
import { ApiOffersPostOperationRequest, ApiOffersPost201Response } from '@capacity-exchange/client';

interface OffersRenderProps {
  submit: (args: ApiOffersPostOperationRequest) => Promise<void>;
  submitting: boolean;
  data: ApiOffersPost201Response | null;
  error: string | null;
}

interface OffersProps {
  children: (props: OffersRenderProps) => React.ReactNode;
}

const Offers: React.FC<OffersProps> = ({ children }) => {
  const api = useCesClient();
  const [data, setData] = useState<ApiOffersPost201Response | null>(null);
  const { run, state } = useSubmit();

  const submit = (args: ApiOffersPostOperationRequest) =>
    run('Submitting offer', () => api.apiOffersPost(args), setData);

  return (
    <>
      {children({
        submit,
        submitting: state.submitting,
        data,
        error: state.error,
      })}
    </>
  );
};

export default Offers;
