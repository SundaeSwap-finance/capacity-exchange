import React from 'react';
import { useApi } from '../hooks/useApi';
import { useApiClient } from '../contexts/ApiContext';

interface HealthCheckRenderProps {
  error: string | null;
  status: 'ok' | 'fail' | undefined;
  uptime: number | undefined;
}

interface HealthCheckProps {
  children: (props: HealthCheckRenderProps) => React.ReactNode;
}

const HealthCheck: React.FC<HealthCheckProps> = ({ children }) => {
  const api = useApiClient();
  const { data: health, error } = useApi(() => api.healthGet(), [], { pollInterval: 2000 });

  return (
    <>
      {children({
        error,
        status: health?.status,
        uptime: health?.uptime,
      })}
    </>
  );
};

export default HealthCheck;
