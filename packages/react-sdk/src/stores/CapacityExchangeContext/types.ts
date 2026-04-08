import { ExchangePrice, Offer } from '@sundaeswap/capacity-exchange-providers';

export type FundingStatus =
  | { status: 'idle' }
  | {
      status: 'prompting-for-currency';
      prices: ExchangePrice[];
      dustRequired: bigint;
      onSelected: (exchangePrice: ExchangePrice) => void;
      onCancelled: () => void;
    }
  | {
      status: 'waiting-for-offer';
      price: ExchangePrice;
      dustRequired: bigint;
      onCancelled: () => void;
    }
  | {
      status: 'confirming-offer';
      offer: Offer;
      dustRequired: bigint;
      onConfirmed: () => void;
      onBack: () => void;
      onCancelled: () => void;
    };
