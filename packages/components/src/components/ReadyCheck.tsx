import React from 'react';
import { HealthReadyGet200Response } from '@capacity-exchange/client';
import { useApi } from '../hooks/useApi';
import { useApiClient } from '../contexts/ApiContext';

interface ReadyCheckRenderProps {
  error: string | null;
  readiness: HealthReadyGet200Response | null;
}

interface ReadyCheckProps {
  children: (props: ReadyCheckRenderProps) => React.ReactNode;
}

const ReadyCheck: React.FC<ReadyCheckProps> = ({ children }) => {
  const api = useApiClient();
  const { data: readiness, error } = useApi(() => api.healthReadyGet(), [], { pollInterval: 2000 });

  return <>{children({
    error,
    readiness,
  })}</>;
};

export default ReadyCheck;
