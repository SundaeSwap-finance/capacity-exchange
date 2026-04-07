import { CapacityExchangeAction } from './actions';
import { FundingStatus } from './types';

export const capacityExchangeReducer = (_state: FundingStatus, action: CapacityExchangeAction): FundingStatus => {
  if (action.action === 'prompt-for-currency') {
    return {
      status: 'prompting-for-currency',
      ...action.payload,
    };
  }
  if (action.action === 'confirm-offer') {
    return {
      status: 'confirming-offer',
      ...action.payload,
    };
  }
  return { status: 'idle' };
};
