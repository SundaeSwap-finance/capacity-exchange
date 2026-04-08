import { ExchangePrice } from '@sundaeswap/capacity-exchange-providers';

export interface PromptForCurrencyProps {
  prices: ExchangePrice[];
  dustRequired: bigint;
  onSelected: (exchangePrice: ExchangePrice) => void;
  onCancelled: () => void;
}

export function DefaultPromptForCurrency({ prices, dustRequired, onSelected, onCancelled }: PromptForCurrencyProps) {
  return (
    <div className="ce-sdk-body">
      <p className="ce-sdk-title">Select payment currency</p>
      <p className="ce-sdk-hint">This transaction requires {dustRequired.toString()} lovelace as dust.</p>
      <div className="ce-sdk-options">
        {prices.map((p) => (
          <button
            key={p.price.currency}
            className="ce-sdk-option"
            title={p.price.currency}
            onClick={() => onSelected(p)}
          >
            <span className="ce-sdk-option-label">{p.price.currency}</span>
            <span className="ce-sdk-option-amount">{p.price.amount.toString()}</span>
          </button>
        ))}
      </div>
      <div className="ce-sdk-actions">
        <button className="ce-sdk-btn ce-sdk-btn-ghost" onClick={onCancelled}>
          Cancel
        </button>
      </div>
    </div>
  );
}
