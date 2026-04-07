import { ExchangePrice } from '@capacity-exchange/providers';

export interface PromptForCurrencyProps {
  prices: ExchangePrice[];
  dustRequired: bigint;
  onSelected: (exchangePrice: ExchangePrice) => void;
  onCancelled: () => void;
}

export function DefaultPromptForCurrency({ prices, dustRequired, onSelected, onCancelled }: PromptForCurrencyProps) {
  return (
    <div>
      <span>{dustRequired}</span>
      {prices.map((p) => (
        <button onClick={() => onSelected(p)}>
          {p.price.currency}: {p.price.amount}
        </button>
      ))}
      <button onClick={onCancelled}>Cancel</button>
    </div>
  );
}
