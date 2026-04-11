import { Currency } from '@sundaeswap/capacity-exchange-react-sdk';

export interface MockPrice {
  amount: string;
  currency: Currency;
}
export const MOCK_PRICE_1: MockPrice = {
  amount: '1000000',
  currency: {
    id: 'shielded:1337133713371337133713371337133713371337133713371337133713371337',
    type: 'shielded',
    identifier: '1337133713371337133713371337133713371337133713371337133713371337',
  },
};
export const MOCK_PRICE_2: MockPrice = {
  amount: '4250',
  currency: {
    id: 'shielded:4242424242424242424242424242424242424242424242424242424242424242',
    type: 'shielded',
    identifier: '4242424242424242424242424242424242424242424242424242424242424242',
  },
};
