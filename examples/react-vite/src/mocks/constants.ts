import { Currency } from '@sundaeswap/capacity-exchange-react-sdk';

export interface MockPrice {
  amount: string;
  currency: Currency;
}
export const MOCK_PRICE_1: MockPrice = {
  amount: '1000000',
  currency: {
    id: 'midnight:shielded:1337133713371337133713371337133713371337133713371337133713371337',
    type: 'midnight:shielded',
    rawId: '1337133713371337133713371337133713371337133713371337133713371337',
  },
};
export const MOCK_PRICE_2: MockPrice = {
  amount: '4250',
  currency: {
    id: 'midnight:shielded:4242424242424242424242424242424242424242424242424242424242424242',
    type: 'midnight:shielded',
    rawId: '4242424242424242424242424242424242424242424242424242424242424242',
  },
};
