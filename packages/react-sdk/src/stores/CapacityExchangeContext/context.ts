import { createContext, Dispatch, useContext } from 'react';
import { FundingStatus } from './types';
import { CapacityExchangeAction } from './actions';

interface Context {
  state: FundingStatus;
  dispatch: Dispatch<CapacityExchangeAction>;
}

export const CapacityExchangeContext = createContext<Context>({
  state: { status: 'idle' },
  dispatch: (_) => {},
});

export const useCapacityExchangeContext = () => {
  return useContext(CapacityExchangeContext);
};
