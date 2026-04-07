import { ExchangePrice, Offer } from '@capacity-exchange/providers';

export type CapacityExchangeAction =
  | {
      action: 'prompt-for-currency';
      payload: {
        prices: ExchangePrice[];
        dustRequired: bigint;
        onSelected: (exchangePrice: ExchangePrice) => void;
        onCancelled: () => void;
      };
    }
  | {
      action: 'confirm-offer';
      payload: {
        offer: Offer;
        dustRequired: bigint;
        onConfirmed: () => void;
        onBack: () => void;
        onCancelled: () => void;
      };
    }
  | { action: 'finish' };
