import { ExchangePrice } from '@sundaeswap/capacity-exchange-providers';
import { currencyName, currencyTitle } from './utils';

export interface WaitForOfferProps {
  price: ExchangePrice;
  dustRequired: bigint;
  onCancelled: () => void;
}

export function DefaultWaitForOffer({ price, onCancelled }: WaitForOfferProps) {
  return (
    <div className="ce-sdk-body">
      <p className="ce-sdk-title">Waiting for offer</p>
      <p className="ce-sdk-hint">You have chosen to pay:</p>
      <div className="ce-sdk-detail">
        <span className="ce-sdk-detail-label">Amount</span>
        <span className="ce-sdk-detail-value">{price.price.amount.toString()}</span>
        <span className="ce-sdk-detail-label">Currency</span>
        <span className="ce-sdk-detail-value ce-sdk-hex" title={currencyTitle(price.price.currency)}>
          {currencyName(price.price.currency)}
        </span>
      </div>
      <div className="ce-sdk-spinner" role="status" aria-label="Loading" />
      <p className="ce-sdk-hint">The server is funding your transaction. This will take a few seconds...</p>
      <div className="ce-sdk-actions">
        <button className="ce-sdk-btn ce-sdk-btn-ghost" onClick={onCancelled}>
          Cancel
        </button>
      </div>
    </div>
  );
}
