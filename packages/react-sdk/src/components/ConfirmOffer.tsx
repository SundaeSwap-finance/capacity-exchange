import { Offer } from '@sundaeswap/capacity-exchange-providers';
import { formatDust } from './utils';

export interface ConfirmOfferProps {
  offer: Offer;
  dustRequired: bigint;
  onConfirmed: () => void;
  onBack: () => void;
  onCancelled: () => void;
}

export function DefaultConfirmOffer({ offer, dustRequired, onConfirmed, onBack, onCancelled }: ConfirmOfferProps) {
  return (
    <div className="ce-sdk-body">
      <p className="ce-sdk-title">Confirm offer</p>
      <div className="ce-sdk-detail">
        <span className="ce-sdk-detail-label">Currency</span>
        <span className="ce-sdk-detail-value ce-sdk-hex" title={offer.offerCurrency}>
          {offer.offerCurrency}
        </span>
        <span className="ce-sdk-detail-label">Amount</span>
        <span className="ce-sdk-detail-value">{offer.offerAmount.toString()}</span>
        <span className="ce-sdk-detail-label">DUST required</span>
        <span className="ce-sdk-detail-value">{formatDust(dustRequired)}</span>
      </div>
      <div className="ce-sdk-actions">
        <button className="ce-sdk-btn ce-sdk-btn-ghost" onClick={onCancelled}>
          Cancel
        </button>
        <button className="ce-sdk-btn ce-sdk-btn-secondary" onClick={onBack}>
          Back
        </button>
        <button className="ce-sdk-btn ce-sdk-btn-primary" onClick={onConfirmed}>
          Confirm
        </button>
      </div>
    </div>
  );
}
