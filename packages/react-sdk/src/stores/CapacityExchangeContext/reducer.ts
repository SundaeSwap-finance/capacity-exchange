import { CapacityExchangeAction } from './actions';
import { FundingStatus } from './types';

export const capacityExchangeReducer = (state: FundingStatus, action: CapacityExchangeAction): FundingStatus => {
  if (action.action === 'prompt-for-currency') {
    return {
      status: 'prompting-for-currency',
      ...action.payload,
    };
  }
  if (action.action === 'wait-for-offer') {
    if (state.status === 'idle') {
      return state;
    }
    return {
      status: 'waiting-for-offer',
      ...action.payload,
    };
  }
  if (action.action === 'confirm-offer') {
    if (state.status === 'idle') {
      return state;
    }
    return {
      status: 'confirming-offer',
      ...action.payload,
    };
  }
  return { status: 'idle' };
};
