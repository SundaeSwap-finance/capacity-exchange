import React from 'react';
import { Get200Response } from '@sundaeswap/capacity-exchange-client';
import { useApi } from '../hooks/useApi';
import { useCesClient } from '../../config';

interface RootInfoRenderProps {
  error: string | null;
  info: Get200Response | null;
}

interface RootInfoProps {
  children: (props: RootInfoRenderProps) => React.ReactNode;
}

const RootInfo: React.FC<RootInfoProps> = ({ children }) => {
  const api = useCesClient();
  const { data: info, error } = useApi(() => api.rootGet(), []);

  return (
    <>
      {children({
        error,
        info,
      })}
    </>
  );
};

export default RootInfo;
